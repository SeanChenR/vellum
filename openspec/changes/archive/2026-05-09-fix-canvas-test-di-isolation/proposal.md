## Problem

Five tests in `apps/api/src/canvas/canvas.test.ts` 與 `apps/api/src/folder/folder.test.ts` 從 repo root 跑 `bun test apps/api` 時 fail：

- `GET /api/canvas/:id — Canvas read by id > non-existent canvas returns 404`
- `PATCH /api/canvas/:id — Canvas update > non-existent canvas returns 404`
- `DELETE /api/canvas/:id — Canvas delete > non-existent canvas returns 404`
- `PATCH /api/folder/:id — Folder rename > non-existent folder returns 404`
- `DELETE /api/folder/:id — Folder delete > non-existent folder returns 404`

每個 fail 拋的都是 `Error: DATABASE_URL is not set. Set it in apps/api/.env (see .env.example).`

## Root Cause

`canvas.test.ts` 跟 `folder.test.ts` 在這 5 個 test 直接呼 `handleCanvasRequest(req, session, rateLimiter)` / `handleFolderRequest(req, session, rateLimiter)` **不傳 deps 物件**。Handler 既有實作對 deps 的處理是「沒傳就 fallback 到 `getDb()` 直接打 DB」（M5 add-sharing 加的 deps optional，pre-M5 行為保留）。

當 `bun test` 從 repo root 跑時不自動載入 apps/api/.env，所以 `Bun.env.DATABASE_URL` 為 undefined、`getDb()` throw、handler exception 冒泡導致 test status 不是預期的 404。

其他 30 個 test pass，因為它們走的程式路徑（auth-required / validation / rate-limit）在打 DB 之前就 short-circuit 回傳 401/400/429。

不是 M13 動到的程式碼導致——M2 / M5 留下的 test 隔離技術債，被 M13 e2e 順手暴露（`bun test apps/api` 五個紅色噪音）。

## Proposed Solution

apply 期間發現：DI 在 canvas handler 是**部分接好**的——只有 `handleRead` (GET) 用了 `deps.loadCanvas`，`handleUpdate` / `handleDelete` 直接呼 `getDb()`。folder handler 則完全沒有 DI，連 `FolderHandlerDeps` interface 都不存在。所以 scope 從原本 test-only 擴大成「補齊 production handler 的 DI、再讓 test 注入 stub」。

具體：

1. **canvas/index.ts** — 把 `handleUpdate` 跟 `handleDelete` 的「load by id 看存在性」那段改成優先用 `deps.loadCanvas?.(canvasId)`，沒 deps 才 fallback `getDb()`。production 行為完全不變（既有 caller 仍然走 DB），只是讓 test 也能走 DI 路徑。
2. **folder/index.ts** — 新增 `FolderHandlerDeps` interface（含 `loadFolder?(folderId): Promise<Folder | null>`）、`handleFolderRequest` 加第 4 個 optional 參數、把 `handleUpdate` / `handleDelete` 的 not-found 早期返回改成優先走 deps。
3. **canvas.test.ts** — 加 `notFoundCanvasDeps = { loadCanvas: async () => null }` helper，3 個 404 test 帶它當第 4 參數。
4. **folder.test.ts** — 加 `notFoundFolderDeps = { loadFolder: async () => null }` helper，2 個 404 test 帶它當第 4 參數。

## Non-Goals

- 不在 `test-setup.ts` 用 dotenv 載入 apps/api/.env（會讓 unit test 變相依賴環境配置）
- 不改 `bun test` 命令本身或 bunfig
- 不擴大到 deploy checklist 上其他 test 隔離議題（auth / share / OG 等等）
- 不把所有 `getDb()` call site 都 DI 化——只動 not-found 早期返回的那條路徑（其餘 production write/query 還是直接用 db 沒問題）

## Success Criteria

- `bun test apps/api/src/canvas/canvas.test.ts` 從 repo root 跑全綠（5.3/5.4/5.5 三個 404 test 都過）
- `bun test apps/api/src/folder/folder.test.ts` 從 repo root 跑全綠（rename / delete 兩個 404 test 都過）
- `bun test apps/api`（整套）pass count 從目前 619/624 升到 624/624（**沒新增 fail**）
- `bun run typecheck` 全綠
- production handler 行為對 既有 caller（`apps/api/src/index.ts` 的 wiring）零變更——沒帶 deps 時繼續走 `getDb()`

## Impact

- Affected code:
  - Modified:
    - apps/api/src/canvas/index.ts（`handleUpdate` / `handleDelete` 在 not-found 檢查階段優先用 `deps.loadCanvas`）
    - apps/api/src/folder/index.ts（新增 `FolderHandlerDeps` interface、`handleFolderRequest` 加 deps 參數、update / delete 優先走 `deps.loadFolder`）
    - apps/api/src/canvas/canvas.test.ts（3 個 404 test 補 deps stub）
    - apps/api/src/folder/folder.test.ts（2 個 404 test 補 deps stub）
  - New: (none)
  - Removed: (none)
- Affected specs: 在 `canvas-management` 與 `folder-management` 各 ADD 一條「handler not-found path is unit-testable without DB access」requirement，明文化「test 注入 deps stub、不依賴 DATABASE_URL」的測試紀律與「handler accepts optional deps for not-found check」的 production 契約。
