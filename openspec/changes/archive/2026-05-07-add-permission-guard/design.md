## Context

Vellum phase 2（Issue #2）即將引入 server-side AI agent，AI agent 透過 Vercel AI SDK 在 Bun.serve 內跑，呼叫 server-side tools 寫入 tldraw sync room。這些寫入端點（M13.x agent endpoint、M14.x mutation pipeline）每個都要回答同一個 HTTP-shape 授權問題：

> 給定當下 request 的 (session, canvasId, allowed roles)，應該放行還是回什麼 status + i18n errorKey？

目前 codebase 已具備的相鄰模組：

- **`apps/api/src/lib/permission.ts`** — 純粹的 boolean predicate `canAccess(user, canvas, action, ctx?)`。它的 caller 自己準備 ctx（`sharedRole`、`publicLinkMode`），它只決定「true / false」。沒有 canvas 存在性、沒有 status code、沒有 errorKey。服務的是既有 share REST routes 的細粒度授權檢查。
- **`apps/api/src/sync/auth.ts`** — `authenticateSyncHandshake(req, canvasId, deps)` 把 cookie + token 雙路徑、handshake 訊息、anon ID 生成綁在一起，回 `{ ok, userId, role } | { ok: false, status, error }`。但它對 WebSocket handshake 量身打造，介面也跟 cookie/token 路徑緊耦合 — AI 寫入端點走的是純 cookie session，沒有 token 路徑。它內部使用的 `resolveCanvasRole(userId, canvasId): { canvasExists, role }` 才是我們真正想複用的 deep module。
- **`apps/api/src/dev/mutate-endpoint.ts`** — M12.1 的 dev-only mutate 端點。目前以 `NODE_ENV !== "production"` 物理隔離（`shouldRegisterDevMutate`），沒有 per-request 授權。

下一步要新增的是 phase 2 production AI 寫入端點 — 在那之前，必須有一個 production-safe、最小、可被多處 import 的 guard，把 dev mutate 端點當作第一個試金石。這就是 Permission Guard。

## Goals / Non-Goals

**Goals:**

- 提供單一 deep module（一個函式 + 一個 deps interface + 一個 result type）讓未來所有 AI 寫入端點以同一行 `await requireRole(...)` 完成授權檢查。
- 把 「(session, canvasId, allowed) → 401/403/404 + errorKey」決策樹從 caller 側完全收進 guard 內部 — caller 拿到 `{ ok: false, status, errorKey }` 就直接 return JSON response，不需要重新拼 status code。
- 設計成 **deps-injected**，使單元測試完全不需要 DB / sync / cookie 解析。
- 把 dev mutate 端點接上 guard，當作 production 上線前的 reference integration。
- 行為對齊 Phase 2 PRD user stories 24（Editor 等同 Owner）、25（Viewer 不能用 AI）、26（匿名訪客不能用 AI）。

**Non-Goals:**

- 不做 production AI 端點（M13/M14 的責任）。
- 不改 `apps/api/src/sync/auth.ts` 的任何內部邏輯 — sync handshake 持續用自己的 wrapper 呼叫同一個 resolver。
- 不擴充 `apps/api/src/lib/permission.ts` — `canAccess()` 跟 `requireRole()` 是兩個 abstraction（純 predicate vs. HTTP-shape decision），合併會稀釋兩個函式的目的性。
- 不支援 public-link / token / anonymous 路徑 — phase 2 PRD 已決定 AI 對匿名訪客物理隔離，guard 對 `session === null` 一律 401。
- 不引入新的 errorKey — 沿用 `errors.auth.unauthorized` / `errors.canvas.notFound` / `errors.canvas.forbidden`。
- 不引入 retry / circuit breaker — guard 是純同步決策（除了一次 DB lookup 透過 deps），沒有外部依賴。
- 不引入 caching — `resolveCanvasRole` 已經是 indexed DB lookup，AI 寫端點是低 QPS（per-user），加 cache 會把 share 變更的同步問題引入 guard。

## Decisions

### Module shape: single function `requireRole(deps, session, canvasId, allowed)` over class / middleware

選擇單一 async function 而非 class 或 framework middleware，原因：

- **Bun.serve 沒有正規 middleware concept** — 我們的 routing 是 plain `if (url.pathname === ...)` 比對。任何「middleware」都會是手寫的 wrapper function，把 guard 包成 middleware 反而多一層 indirection。
- **caller 仍負責 response 組裝** — guard 回傳結構化結果，caller 決定要不要把 errorKey 包進更大的 envelope（例如有些端點要附 `retryAfter`）。這對齊 `apps/api/src/sync/auth.ts::authenticateSyncHandshake` 的既有 contract（也是回 `{ ok, status, error }` 給 caller）。
- **方便 inline `if (!result.ok) return jsonResp(result.status, ...)`** — 在 dev mutate 端點裡只要兩行。

### Deps interface: 單一相依 `resolveCanvasRole`，不依賴 sync auth 的 wrapper

`PermissionGuardDeps` 只暴露一個方法：

```ts
resolveCanvasRole(userId: string | null, canvasId: string)
  : Promise<{ canvasExists: boolean; role: CanvasRole | null }>
```

選擇這個介面而非依賴 `SyncAuthDeps` 全部三個方法（`resolveSession` / `resolveCanvasRole` / `resolveCanvasShareLink`），原因：

- AI 端點走純 cookie session — 完全不需要 `resolveCanvasShareLink`（token 路徑），引入會誤導 future contributor 以為 guard 支援 anonymous。
- AI 端點的 caller 已自己拿到 `session: { userId } | null`（從 better-auth 的 session middleware 解出來），不需要 guard 再做 cookie 解析。
- 把 `resolveCanvasRole` 列為唯一 dep，production wiring 時就指 sync server 用的同一個 function — 沒有重複實作。

`role` 的型別擴成 `"owner" | "editor" | "viewer" | "anon"`，但 production resolver 永遠不會回 `"anon"`（它只在這個 union 裡為了未來語意完整保留 — 現階段所有 anon 路徑都被前置的 `session === null` 攔下）。

### Result shape: `{ ok: true } | { ok: false, status, errorKey }`

採用 discriminated union，原因：

- TypeScript narrowing 直接 — caller `if (!result.ok)` 後 `status` / `errorKey` 自動非 undefined。
- `status` 限定為 `401 | 403 | 404`，型別系統就鎖死 guard 不會回 200/500，意外擴充必須改型別。
- `errorKey` 是字串字面量是 i18n key — 對齊 server-wide 的 contract（`packages/shared/src/api-contract.ts` 已收錄這三個 key）。

備選：沿用 sync auth 的 `error: string`（不是 errorKey-typed）— 拒絕，因為 phase 1 已從那個鬆散型別吃過虧（誰都能傳任意字串，client 對應失準）。

### 行為矩陣優先序：null session → 不存在 canvas → 角色不夠

決策順序在實作裡是 fixed：

1. **`session === null`** → 401（對所有 canvas 都一樣，不要洩漏「canvas 存不存在」這個資訊給未登入請求者）。
2. **`canvasExists === false`** → 404（authenticated user 對不存在的 canvas 應該收 404 而非 403，避免 enumeration attack 但也不要假裝存在）。
3. **`role === null`**（authenticated user 沒有任何 role 對該 canvas）→ 403（明確拒絕，但不揭露「你只是缺權限」 vs 「不存在」— 因為前一步已確認存在）。
4. **`role` 不在 `allowed` 內** → 403（同樣 errorKey，不需區分「沒權限」vs「角色不夠」— 從 attacker 視角等價）。
5. **`role` 在 `allowed` 內** → `{ ok: true }`。

備選：把（3）跟（4）合併成「authenticated 但 role 不夠」一律 403 — 採用，這就是現在的設計（兩條都回同一個 errorKey）。

### dev mutate 整合：guard 注入 `DevMutateDeps`

把 guard 當作 dependency 注入而非硬 import，是為了維持 dev mutate endpoint 既有的 testability — 它的測試已經完全 dep-inject 化（`makeDeps()` helper），新欄位沿用相同模式。

`DevMutateDeps` 新增：

```ts
permissionGuard: PermissionGuardDeps;
```

handler 內呼叫順序：rate-limit → permission guard → JSON parse → mutator dispatch。permission guard 在 rate-limit 之後是因為 401 路徑也應該被 rate limit（避免認證探測攻擊）— 對齊 sync handshake 的既有設計。

### Test strategy: 單元測試覆蓋全矩陣，整合測試只驗證「guard 真的接上了」

`permission-guard.test.ts` 為**真正的單元測試** — 注入 stub deps，覆蓋全部 5 個矩陣 × 2 種 `allowed` 組合（`["owner", "editor"]` AI 寫端點用、`["owner"]` 將來 admin-only 端點預留）。每個 case 都是 `[P]` 平行可寫的獨立 test。

`mutate-endpoint.test.ts` 新增四組 case：

1. viewer role → 403 + `errors.canvas.forbidden`，且 `applyMutation` 不被呼叫。
2. editor role → 200（既有 happy path 改用 always-allow stub）。
3. session = null → 401 + `errors.auth.unauthorized`。
4. canvasExists = false → 404 + `errors.canvas.notFound`。

整合 layer 不再展開全矩陣 — 那是 unit test 的責任。

### Production wiring：`apps/api/src/index.ts` 一次性接線

production 路由註冊處新增：

```ts
const permissionGuardDeps: PermissionGuardDeps = {
  resolveCanvasRole: <既有 sync server 用的 resolver>,
};
```

然後傳入 `DevMutateDeps`（dev gating 仍保留 `shouldRegisterDevMutate`）。phase 2 AI 端點可以直接共用同一個 `permissionGuardDeps` 物件。

## Risks / Trade-offs

- **Risk: caller 忘記呼叫 `requireRole` 就直接 dispatch** → Mitigation：spec 把「endpoint 必須先過 guard」寫成 requirement scenario；phase 2 AI 端點上線時 code review checklist 把這個明確列入；新端點通常從 dev mutate endpoint 複製出去，整合範本天然帶這行。
- **Risk: `CanvasRole` 包含 `"anon"` 但 production resolver 永遠不回 `"anon"`** → Mitigation：保留是為了未來如果想支援匿名 AI session（理論上不會但留著不破壞型別）；guard 在 `session === null` 早期路徑就回 401，無論 resolver 怎麼回都不會走到 `role === "anon"` 分支。為了避免 dead-code 警告，`requireRole` 的型別簽章不限制 resolver 必須回 `"anon"`，但實作邏輯會把它跟「不在 allowed 裡」同樣處理。
- **Risk: 401 / 403 / 404 訊息可能洩漏 canvas 存在性** → Mitigation：`session === null` 對任何 canvasId 都回 401（不查 DB），所以未登入訪客拿不到 canvas enumerative 資訊；只有 authenticated user 才能區分 404 vs 403 — 這是預期行為（PRD 要求）。
- **Trade-off: guard 不快取 role lookup** → 每個 AI 寫請求多一次 indexed DB lookup（< 5ms 在本地 Postgres）。phase 2 AI agent 一輪 turn 平均 30s+，這個 overhead 可忽略。如果 phase 3 出現高 QPS 端點再加 cache。
- **Trade-off: guard 不重用 `apps/api/src/lib/permission.ts::canAccess`** → 兩個模組做的事不同（純 predicate vs HTTP-shape 決策），合併會把兩個關注點塞進同一函式。代價是 share REST routes 跟 AI 端點走兩條授權路徑 — 但兩者本來就服務不同 use case（細粒度 share action permission vs 粗粒度 AI 寫權限），分開反而清楚。

## Migration Plan

不適用 — 這是純新增，沒有資料遷移、沒有 schema 變更、沒有 breaking API change。dev mutate endpoint 的測試會隨變更同步更新。

## Open Questions

無。所有設計決策已在本文件鎖定。
