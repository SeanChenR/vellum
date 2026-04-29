## Context

此為 Vellum phase 1 第二個 milestone（M2，緊接 M1 add-auth）。M1 落地後資料庫已具備 `users` 與 better-auth 標準的 `sessions` / `accounts` 表；本 change 在此之上加 `folders` 與 `canvases`，並讓使用者首次能在 `/dashboard` 看到完整的列表 + 1 層 folder 整理。

當下 scaffolding 已具備：

- Drizzle 占位檔案 `apps/api/src/db/schema.ts`（目前只有 `export {}`，schema 尚未開始長）
- 既有 deep module：Drizzle 入口 `apps/api/src/db/index.ts`（lazy init Bun SQL adapter）、SSRF guard `apps/api/src/lib/validate-external-url.ts`、`RateLimiter` 在 `apps/api/src/lib/rate-limiter.ts`
- 前端基礎：`apps/web/src/router.tsx`（TanStack Router 已掛 root + index），`apps/web/src/lib/queryClient.ts`（TanStack Query default options）

依據 ADR-0003 monorepo 邊界，本 change 跨三個 package：

- `apps/api`：DB schema、permission shell、REST 路由
- `packages/shared`：API contract zod、locale JSON、型別匯出
- `apps/web`：dashboard 頁、CRUD UI、router 路由

下游 add-canvas-editor-shell 將在本 change 落地的 `canvases.snapshot jsonb` 上掛 tldraw 持久化；add-sharing 會擴張 `permission.ts` 並新增 `canvas_shares` / `canvas_share_links` 表。

## Goals / Non-Goals

**Goals:**

- 落實 PRD US #9-16 的 CRUD 與 list 體驗；雙語 i18n 在同一個 change 同步。
- 建立 `canvas-management` 與 `folder-management` 兩個獨立 capability，邊界清晰可被後續 change 引用。
- 在這個 change 就把 `canAccess(user, canvas, action)` 的簽名與 phase 1 owner-only 預設行為定下來，避免 add-sharing 來時得回頭改所有路由的 auth 檢查。
- 對 dashboard list 的「Shared with me」區塊定義 read-only 介面假設，使其可在未來 add-sharing 完成後零改動接上資料。
- 所有 endpoint 在定義當下就帶 rate-limit 規則（per-user / per-IP），絕不事後補。

**Non-Goals:**

- 不做 sharing schema migration（`canvas_shares`、`canvas_share_links` 由 add-sharing 擁有）
- 不做 canvas 編輯體驗（由 add-canvas-editor-shell 擁有）
- 不做縮圖產生（等 add-export 提供 SVG snapshot 後接）
- 不做 multi-level folder（PRD 明確 1 層）
- 不做 owner transfer ownership endpoint
- 不做 mobile responsive（PRD OOS guard）
- 不做活動歷史 / 版本歷史 / Sentry（PRD OOS guard）

## Decisions

### Schema 與 FK 約束

`folders`：

- `id` uuid pk（`gen_random_uuid()`）
- `owner_id` uuid not null，FK → `users.id` ON DELETE CASCADE
- `name` text not null（max 80 chars，前後端皆 zod 驗證）
- `created_at` / `updated_at` timestamptz with default now()
- index：`(owner_id, name)` 不設唯一（PRD 沒要求 unique，重名是合法的）

`canvases`：

- `id` uuid pk
- `owner_id` uuid not null FK → `users.id` ON DELETE CASCADE
- `folder_id` uuid nullable FK → `folders.id` ON DELETE SET NULL（關鍵：folder 被刪 canvas 不該跟著消失，回到「無分類」）
- `title` text not null（max 120 chars）
- `snapshot` jsonb not null default `'{}'::jsonb`（add-canvas-editor-shell 來時直接寫進去，不用再 migration）
- `created_at` / `updated_at` timestamptz
- index：`(owner_id, updated_at desc)`（dashboard list 主要排序）

理由：`folder_id` 用 SET NULL 而非 CASCADE 是 defensive UX 的延伸——但配合 application 層 DELETE folder 不為空就拒絕，正常路徑下不會走到 SET NULL，這條只是 paranoia 防線（例如未來真的 transfer ownership 時）。

替代方案：folder_id 加 NOT NULL 並建一個 system-default folder「Inbox」。Reject 因為會讓 schema 多一個特例（每個 user 必須有恰好一個 system folder），且 PRD 的 dashboard 設計就是「沒分類的 canvas 直接攤在最上層」。

### Permission shell：先簽名，後實作

新增 `apps/api/src/lib/permission.ts` 匯出：

```
type CanvasAction = 'read' | 'write' | 'delete' | 'share'
function canAccess(user: User | null, canvas: Canvas, action: CanvasAction): boolean
```

phase 1 規則（本 change 實作）：`user?.id === canvas.ownerId` 對所有 action 回 true，否則回 false。後續 add-sharing 來時擴充 share rows 與 public link mode 的判定，所有 caller 不用動。

這是一個 NEW deep module。雖然此刻邏輯極短，但因為它定義了權限 contract，所以從第一天就走 `apps/api/src/lib/permission.ts` + `permission.test.ts` 的格式（跟 `RateLimiter`、`validateExternalUrl` 一致）。

替代方案：把 owner 檢查直接 inline 在每個 route handler。Reject 因為等到 add-sharing 來補 `share rows + public link mode + token` 三層邏輯時，要改的地方會散在每個 handler；deep module 從第一天就劃好邊界。

### 「Shared with me」list 的 forward-compat 介面

dashboard list 端會呼叫 `GET /api/canvas?scope=shared`。本 change 對此 endpoint 的 contract 是：

- 永遠回 200 + `{ data: [], meta: { total: 0 } }`（phase 1 暫時固定空陣列）
- TypeScript layer 已宣告 query 形狀為「join `canvas_shares` 表後過濾 user_id」，但實際 SQL 在 add-sharing 落地前 short-circuit 回空集

如此 add-sharing 只需要：(1) 加表 migration、(2) 解開 `canvas/index.ts` 內 `if (scope === 'shared') return []` 那一行 short-circuit，零路由結構改動。

替代方案 A：本 change 完全不開 `?scope=shared`，等 add-sharing 來才加。Reject 因為 dashboard UI 這個 change 就要展示空狀態的 Shared with me 區塊（PRD US #9 要求兩區並存）；不開 endpoint dashboard 沒辦法 lay out。

替代方案 B：本 change 一併建 `canvas_shares` 表 schema。Reject 因為這會讓 add-sharing 變成「擴充表 + 加邏輯」雜訊化，違反 spec 邊界乾淨原則。

### Rate limit 規則表

REST endpoints（key prefix 為 `api:<endpoint>:<userId>`）：

- `POST /api/canvas` — 10 / user / 60s
- `PATCH /api/canvas/:id` — 60 / user / 60s
- `DELETE /api/canvas/:id` — 30 / user / 60s
- `GET /api/canvas` (list) — 60 / user / 60s
- `GET /api/canvas/:id` — 100 / user / 60s（permissive，預期 collab refresh 會打）
- `POST /api/folder` — 10 / user / 60s
- `PATCH /api/folder/:id` — 30 / user / 60s
- `DELETE /api/folder/:id` — 10 / user / 60s
- `GET /api/folder` — 60 / user / 60s

429 回應一律帶 `Retry-After` header，body 為 `{ error: 'errors.rateLimit', retryAfter: <s> }`。

理由：寫 / 刪較嚴（10/min 已比正常使用者點擊頻率大兩個量級）；讀路徑放寬至 60-100/min 容納編輯器即時刷新。

替代方案：unified 30/min for everything。Reject 因為 `GET /api/canvas/:id` 的 100/min 對應 collab 編輯器每秒輪詢 freshness 的場景，被 30/min 卡住會讓 add-canvas-editor-shell 階段反推改回來。

### Error envelope 與 errorKey 命名

response shape 統一：

- 成功：`{ data: <T>, meta?: <PaginationMeta> }`
- 失敗：`{ error: <errorKey>, retryAfter?: <number> }`

phase 1 errorKey 範圍（全進 zh-TW + en locale）：

- `errors.auth.unauthorized` — 401
- `errors.canvas.notFound` — 404
- `errors.canvas.forbidden` — 403
- `errors.folder.notFound` — 404
- `errors.folder.forbidden` — 403
- `errors.folder.notEmpty` — 409（DELETE folder 仍含 canvas）
- `errors.validation` — 400（zod 驗證失敗，body 額外帶 `details: ZodIssue[]`）
- `errors.rateLimit` — 429
- `errors.internal` — 500

Server **永遠不回翻譯後字串**（CLAUDE.md hard rule 2）。

### 前端架構：dashboard 用 TanStack Query 為 source of truth

- `useCanvasList(scope)` / `useFolderList()` 以 useQuery 包 `/api/canvas` / `/api/folder`
- mutation（create / rename / delete / move）以 useMutation 並走 invalidateQueries
- Drag canvas 進出 folder：用 `dnd-kit`（已在 phase 1 stack 中為 dashboard 而引入）；drop event 觸發 PATCH `/api/canvas/:id` { folderId }
- Optimistic update：rename 與 move 走 optimistic（顯著互動）；delete 不走 optimistic（破壞性）

CanvasCard / FolderTree 是 NEW shallow glue（純展示元件接 hooks）；唯一的 NEW deep module 是 `permission.ts`。

替代方案：用 Zustand 管 list state。Reject 因為 server state 的快取與失效在 TanStack Query 裡解一次，自己用 Zustand 等於重做一次。

### Migration 路徑

- `apps/api/drizzle/0001_*.sql` 由 add-auth 產出（users / sessions / accounts / magic_links）
- 本 change 的 migration 為 `apps/api/drizzle/0002_canvas_folder.sql`，由 `bunx drizzle-kit generate` 產自 schema diff
- `bunx drizzle-kit migrate` 在 dev 用；CI 跑 server integration test 前先在 Neon test branch 跑 migrate

替代方案：手寫 SQL migration。Reject 因為 phase 1 stack 已選定 drizzle-kit，手寫等於繞過 schema-as-source-of-truth。

## Risks / Trade-offs

- **`scope=shared` short-circuit 一旦忘了在 add-sharing 解開 → dashboard 永遠空**：Mitigation — 在 short-circuit 那行寫明確 TODO comment 帶 add-sharing 的 spec 名稱；add-sharing 的 tasks.md 將顯式列「remove short-circuit in canvas/index.ts」。
- **`folder_id` ON DELETE SET NULL 在某些 race condition 下可能讓 canvas 無聲掉到無分類**：Mitigation — application 層 DELETE folder 路由先檢查不為空才放行；DB 層 SET NULL 是純粹的二道防線。Server integration test 覆蓋「folder 不為空 DELETE 回 409」場景。
- **dashboard 元件較多（CanvasCard、FolderTree、6 個 dialog），單一 PR 量大**：Mitigation — 以 TDD 拆 task：每個 dialog 為獨立 task（先 component test → 寫 dialog → 接 dialog 進 dashboard）。視覺迭代不上 review queue。
- **i18n 字串易漏掉某語言**：Mitigation — tasks 內顯式列「同步 zh-TW + en」一個 task；CI 加一個檢查兩 locale JSON 的 key 集合相同的 unit test（已在 add-auth 的 task 中 setup，本 change 直接受惠）。
- **Drizzle migration 在 PR review 時不直觀**：Mitigation — task 完成後 commit migration SQL 一併 review，tasks.md 顯式提醒不可手動編 migration 檔案。

## Migration Plan

1. 在 schema.ts 加 `folders` 與 `canvases` table 定義
2. `bunx drizzle-kit generate` 產出 `0002_canvas_folder.sql`，人工 review 該 SQL 內容
3. 在開發機 `bunx drizzle-kit migrate` 套用
4. CI 整合測試流程：跑測試前在 Neon test branch 自動 `migrate`
5. Rollback 策略：本地用 `drizzle-kit drop` + 手動回到 0001；phase 1 尚未上線，無 production rollback 顧慮（phase 2 deploy 前需另行設計 rollback runbook，已在 deploy checklist 中追蹤）

## Open Questions

(目前無需 user 介入決策的開放問題；上述 decisions 皆為本 change 範圍內的合理預設。)
