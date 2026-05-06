## Context

Vellum Phase 2（Issue #2）要在既有 Bun.serve + tldraw sync 架構上加 server-side AI agent。Phase 2 PRD 把整個 AI feature 拆成 12 個模組，其中第 4 個 `Server tldraw Mutator`（PRD 表格 #4，標 deep module）是整條垂直管道最高風險的點：tldraw 官方 docs 對「server 端從 WebSocket 連線之外、對 active TLSocketRoom 套用變更並觸發廣播」的著墨非常薄，而我們又必須跨這條 bridge 保留 `editor.batch(...)` 語意，否則 PRD US 12（Cmd+Z 整輪退）做不到。

目前的 sync server（`apps/api/src/sync/index.ts` + `room.ts` + `auth.ts`）是 Phase 1 留下的 TLSocketRoom 包裝，所有 mutation 都假設來自 `room.handleSocketMessage`（也就是某個連線的 client 推進來）。這次 spike 要打開另一條入口：dev REST endpoint → mutator → TLSocketRoom 內部 store/transaction API → 既有 broadcast pipeline。

Spike 的成功標準：
- 真 sync server 起著、瀏覽器透過正常 WS 連著、`POST /dev/canvas/<id>/mutate` 帶 `createShape` payload 進去 → 瀏覽器看到 shape 出現
- Integration 測試裡 WS client 收到對應的 sync update message（不是 mock，是真的）
- Batch 語意被驗證：在同一個 mutator call 裡套兩個 createShape，client 端 Cmd+Z 退一次回到兩個都不在的狀態

如果做下去發現 TLSocketRoom 沒有公開的 server-side mutation API、必須走 internal API（如 `room.updateStore` 或直接操作 `room.store`），ADR 0013 會記錄選用的進入點、為什麼選它、tldraw 升級時的破裂風險，以及替代方案（例如 fork tldraw sync、或改用 store-level 寫入再手動發 broadcast）。

## Goals / Non-Goals

**Goals:**

- 提供 `applyMutation(canvasId, mutation)` 介面，input 是 discriminated union，M12.1 只 wire `createShape`
- 跨 server-client bridge 保留 batch 語意：`applyMutation` 接受 `mutations: Mutation[]` 陣列（單元素 = 單 mutation；多元素 = batch），整個陣列在 client 端視為單一 undo entry
- Mutator 拋出的所有 error 是結構化 `Result<{ ok: true, ... } | { ok: false, errorKey: string }>`，REST 端點把 errorKey 直接回給 caller
- Dev-only REST endpoint `POST /dev/canvas/:id/mutate` 只在 `Bun.env.NODE_ENV !== "production"` 註冊；production 路由樹裡完全沒有這條路徑
- 端點走既有 `RateLimiter`，rule key `dev.mutate`，per-user，30/60s
- Integration 測試對真 sync server + 真 TLSocketRoom 跑：開 client A → POST 觸發 mutator → 等 client A 收 update message → assert shape 出現在 snapshot
- ADR 0013 紀錄選用的 TLSocketRoom 進入點與相關 trade-off

**Non-Goals:**

- 任何 op type 不是 `createShape`（updateShape / deleteShape / connectShapes / groupShapes / ungroupShape / 任何 read tool）— 屬 M12.2
- Agent runtime / Vercel AI SDK 接線 / streamText loop — 屬 M13.1
- LLM provider 抽象 / BYOK / API key vault — 屬 M13.2 與並行的 `add-byok-anthropic`
- Canvas Digest Builder / pull tools — 屬 M13.3
- Permission Guard 對 mutator 的整合（dev 端點本身在 production 不存在，所以 spike 期不需要）— 等 M13.x 真 production endpoint 進來再做
- 真正的 production AI mutation endpoint（`POST /api/agent/...`）— Phase 2 末期
- E2E（Playwright）覆蓋 — 這是 spike，integration 測試足夠；E2E 留給 M13.x

## Decisions

### Mutation 介面：accept 陣列、保留 batch 語意

`applyMutation` 簽名定為：

```
applyMutation(canvasId: string, mutations: Mutation[]): Promise<Result>
```

不是 `applyMutation(canvasId, mutation: Mutation)` 單筆版本。理由：

- tldraw `editor.batch(...)` 在 client 端行為是「把 fn 內所有 store change 包成單一 undo entry」。Server 端要等價地做到，最自然的對應是「一個 mutator call → 一個 batch transaction」。如果接成單筆 mutation，多筆 batch 就要在外層多包一層 `applyMutationBatch([...])`，介面被分裂沒好處。
- 單筆 case 就是 `applyMutation(id, [oneMutation])`，呼叫端負擔極小。

`Mutation` 是 discriminated union，M12.1 只實作 `{ type: "createShape", payload: ShapeCreatePayload }`；M12.2 加新 type 不破壞 caller 的型別。

### TLSocketRoom 內部 API 選擇 — 由 spike 決定，紀錄到 ADR

候選進入點：

1. `room.store.put(records)` — 直接寫底層 store；TLSocketRoom 應該會偵測到變更並廣播
2. `room.updateStore(fn)` — 如果有 transaction 包裝版，這是首選（最接近 client 端 `editor.batch`）
3. 包一個假的「server session」走 `room.handleSocketMessage` — 太黑魔法、純度低

Spike 目標是逐個試 (1) → (2)，**不採 (3)**。最終選用哪個由 implementation 階段驗證決定，並寫進 ADR 0013。如果 (1) 和 (2) 都不可行（例如 broadcast 沒被觸發），就 fork tldraw sync 或調 internal pipeline，但這條路走下去前要先回到 design 重新對齊。

### Dev endpoint 的物理隔離 — production 完全不註冊

Production 不應該有任何方式觸發 dev mutator endpoint，連 404 都太露骨。實作方式：

```
// apps/api/src/index.ts
if (Bun.env.NODE_ENV !== "production") {
  routes["/dev/canvas/:id/mutate"] = devMutateHandler;
}
```

理由：

- Dev endpoint 唯一目的是 spike + 後續本地測試，不應有 production 表面
- 若改成「production 註冊但 401」會留攻擊面（authn bug 一個就出事）
- 對齊 PRD 已凍 deploy（ADR 0004），Phase 2 也沒打算 deploy，但 Phase 1 → Phase 2 過渡前的 deploy checklist 會檢查這條

`Bun.env.NODE_ENV` 預設是 `undefined`，dev 自動 enable；生產 deploy 時 process manager 必須設 `NODE_ENV=production`（已是 industry default）。

### Rate limit rule

新增 `DEV_MUTATE_RULE: { windowMs: s(60), max: 30 }`，per-user。理由：

- Dev only 但仍要遵守專案 rate-limit 紀律（每個 endpoint 必須在定義時宣告）
- 30/60s 給開發者試錯有餘裕，不會踩到 limit；同時防止測試 script 跑爆
- 429 帶 `Retry-After` header（沿用既有 RateLimiter 行為）

### Integration 測試走真 sync server，不 mock

依專案 prior art（`apps/api/src/sync/index.test.ts` 對真 WebSocket）以及 PRD「Tool Surface · Server tldraw Mutator · Permission Guard 屬 integration tier」決策：

- 測試起一個真的 Bun.serve + sync server + 一張 fixture canvas
- 用 Bun WebSocket client 連上去（模擬瀏覽器）
- 對 dev endpoint 發 POST
- 等到 WS client 收到 sync update message 為止（用 promise + timeout）
- assert 收到的 record 含預期的 shape

不 mock 任何 sync 內部 — 這是 spike，mock 等於沒驗證 broadcast 路徑。

### 錯誤合約與 i18n

Mutator 的失敗模式：
- `errors.devMutate.invalidPayload` — Zod schema 驗證失敗
- `errors.devMutate.canvasNotInActiveRoom` — 沒人連著、room 不在 registry；M12.1 不負責 lazy hydrate（lazy hydrate 是 M12.2 的事）
- `errors.devMutate.mutationFailed` — TLSocketRoom 內部 throw（極端情況）

Locale key 兩語言同步加。zh-TW 文案口吻沿用既有 errors.canvas.* 風格。

## Risks / Trade-offs

- **TLSocketRoom 的 mutation API 可能是 internal、未 documented** → ADR 0013 紀錄選用的進入點、加 type-level comment 標明風險、tldraw 升級時把 `mutator-integration.test.ts` 當 canary（升級後跑這條測試決定是否 block）。
- **Batch 語意可能跨 bridge 失真** → integration 測試裡明確驗證「兩個 mutation 套完、Cmd+Z 一次退掉兩個」；如果 client 端要分兩次按 Cmd+Z，視為 bridge 沒做到 batch，回 design 重評。
- **Dev endpoint 漏到 production** → production 絕對不註冊（不是 if-401），加單元測試覆蓋 `Bun.env.NODE_ENV === "production"` 時 endpoint 不掛載；deploy checklist 加一條人工 audit。
- **Rate-limit rule 漏配** → 走 type-driven flow：rate limit middleware 對沒有 rule 的 endpoint throw 不啟動（既有專案紀律）；dev endpoint 必須在 wiring 時宣告 rule，否則整個 server 起不來。
- **Mutator throw 未捕捉的 exception 弄掛 sync server** → mutator 內所有 TLSocketRoom 互動包在 try/catch、回 `{ ok: false, errorKey }`；不讓內部 throw 透到 sync server event loop。
- **Sibling change `add-byok-anthropic` 同時動 packages/shared/locales/*.json** → 兩邊新增的 locale keys namespace 不重疊（dev mutator 用 `errors.devMutate.*`、BYOK 用 `errors.byok.*` / `settings.apiKeys.*`），merge 時不會撞。

## Migration Plan

無 — 純 additive change：
- 新增模組、新增端點（dev only）、新增 spec capability、新增 ADR
- 不動 schema、不動既有 spec requirement、不動 production routing
- Rollback 策略：revert commit 即可，無 data migration、無 idempotency 需求

## Open Questions

- 實作階段才能確認 TLSocketRoom 對 server-side write 的內部 API 形狀；ADR 0013 在 implementation 真的決定後補完。
- 若 batch 語意需要在 client 端配合（例如 client editor 對 server 來的 update batch 識別），M12.1 範圍只證明 server 端 batch、不擴充 client；client 端配合若有需要由 M12.2 / M13.x 接手。
