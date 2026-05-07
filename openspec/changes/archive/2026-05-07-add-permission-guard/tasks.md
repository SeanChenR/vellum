## 1. Tests First — Permission Guard unit tests (RED)

- [x] 1.1 [P] 在 `apps/api/src/lib/permission-guard.test.ts` 撰寫單元測試 case：null session → 401（驗證 `Permission Guard gates write-side AI surfaces by canvas role` 中 step 1 的 `Unauthenticated request is rejected before any canvas lookup` scenario，包含 example 中匿名 public-link visitor 被擋下、resolver stub call count = 0）
- [x] 1.2 [P] 撰寫 case：authenticated user + `canvasExists === false` → 404 errorKey `errors.canvas.notFound`（對應 `Authenticated request to non-existent canvas returns 404` scenario）
- [x] 1.3 [P] 撰寫 case：authenticated user + `canvasExists === true` + `role === null` → 403 errorKey `errors.canvas.forbidden`（對應 `Authenticated request to existing canvas with no role returns 403` scenario）
- [x] 1.4 [P] 撰寫 case：role 不在 allowed 內 → 403（含 viewer 對 ["owner","editor"]、editor 對 ["owner"]、anon 對 ["owner","editor"] 三個排列；對應 `Role exists but is not in the allowed list returns 403` scenario 的 example 表）
- [x] 1.5 [P] 撰寫 case：role 在 allowed 內 → `{ ok: true }`（含 owner→["owner","editor"]、editor→["owner","editor"]、owner→["owner"] 三個排列；對應 `Role is in the allowed list returns ok` scenario）
- [x] 1.6 [P] 撰寫 case 驗證 decision precedence：`session === null` 即使 resolver 會回 `canvasExists: false` 也不被呼叫（對應 `Decision precedence is null-session before canvas-existence before role` scenario）
- [x] 1.7 跑 `bun test apps/api/src/lib/permission-guard.test.ts`，確認所有新測試 FAIL（檔案還不存在 → import error 也算 RED）

## 2. Implementation — Permission Guard module (GREEN)

- [x] 2.1 建立 `apps/api/src/lib/permission-guard.ts`，匯出 `CanvasRole` 型別、`PermissionGuardDeps`、`RequireRoleResult`、`requireRole` 函式（依設計文件「Module shape: single function `requireRole(deps, session, canvasId, allowed)` over class / middleware」與「Deps interface: 單一相依 `resolveCanvasRole`，不依賴 sync auth 的 wrapper」決策）
- [x] 2.2 實作五步決策矩陣，順序鎖死 null-session → canvasExists → role==null → role∉allowed → ok（依設計文件「行為矩陣優先序：null session → 不存在 canvas → 角色不夠」決策）
- [x] 2.3 採用 discriminated union result type `{ ok: true } | { ok: false, status: 401|403|404, errorKey }`（依設計文件「Result shape: `{ ok: true } | { ok: false, status, errorKey }`」決策；errorKey 限定為三個既有 i18n key）
- [x] 2.4 跑 `bun test apps/api/src/lib/permission-guard.test.ts` 確認全部 GREEN

## 3. Tests First — Dev mutate endpoint integration (RED)

- [x] 3.1 [P] 在 `apps/api/src/dev/mutate-endpoint.test.ts` 新增 viewer case：resolver 回 `{ canvasExists: true, role: "viewer" }` → 403 errorKey `errors.canvas.forbidden`，且 `applyMutation` 不被呼叫（對應 `Dev mutate endpoint enforces Permission Guard before applying mutations` 中 `Viewer is rejected with 403 before the mutator runs` scenario）
- [x] 3.2 [P] 新增 editor case：resolver 回 `{ canvasExists: true, role: "editor" }` → 200，dispatcher 被呼叫（對應 `Editor passes the guard and reaches the mutator` scenario）
- [x] 3.3 [P] 新增 null session case → 401 errorKey `errors.auth.unauthorized`（對應 `Missing session is rejected with 401` scenario）
- [x] 3.4 [P] 新增 unknown canvas case：resolver 回 `{ canvasExists: false, role: null }` → 404 errorKey `errors.canvas.notFound`（對應 `Unknown canvas is rejected with 404` scenario）
- [x] 3.5 [P] 新增 ordering case：rate-limit 用盡時即使 session=null 仍先回 429（對應 `Guard runs after rate-limit but before payload validation` scenario 的 ordering 矩陣）
- [x] 3.6 既有 happy path / errorKey mapping / rate-limit case 改用 always-allow stub（注入 `permissionGuard.resolveCanvasRole` 一律回 `{ canvasExists: true, role: "editor" }`），保留覆蓋率（依設計文件「Test strategy: 單元測試覆蓋全矩陣，整合測試只驗證「guard 真的接上了」」決策 — 單元層走全矩陣，整合層只驗證接線）
- [x] 3.7 跑 `bun test apps/api/src/dev/mutate-endpoint.test.ts` 確認新測試 FAIL（既有測試也會 fail 因為 `DevMutateDeps` 還沒新增欄位）

## 4. Implementation — Wire guard into dev mutate endpoint (GREEN)

- [x] 4.1 在 `apps/api/src/dev/mutate-endpoint.ts` 的 `DevMutateDeps` 介面新增 `permissionGuard: PermissionGuardDeps` 欄位（依設計文件「dev mutate 整合：guard 注入 `DevMutateDeps`」決策）
- [x] 4.2 在 `handleDevMutateRequest` 中於 rate-limit 通過後、JSON parse 前插入 `await requireRole(deps.permissionGuard, session, canvasId, ["owner", "editor"])`；若 `ok === false` 用 `jsonResp(result.status, { ok: false, errorKey: result.errorKey })` 直接 return
- [x] 4.3 把 `session` 參數型別改為 `SessionLike | null` 以容納 unauthenticated request（spec 要求 guard 處理 null session，handler 也要傳得進來）
- [x] 4.4 跑 `bun test apps/api/src/dev/mutate-endpoint.test.ts` 確認全部 GREEN

## 5. Production wiring

- [x] 5.1 在 `apps/api/src/index.ts` dev mutate 路由註冊處組裝 `permissionGuardDeps: PermissionGuardDeps` 物件，把 `resolveCanvasRole` 指向 sync server 既有 resolver（依設計文件「Production wiring：`apps/api/src/index.ts` 一次性接線」決策；不重複實作）
- [x] 5.2 把組好的 `permissionGuard` 注入 `DevMutateDeps` 傳給 handler

## 6. Verification

- [x] 6.1 跑 `bun test` 全套，確認 0 regression
- [x] 6.2 跑 `bun run typecheck` 確認型別 clean
- [x] 6.3 跑 `bunx oxlint apps/api/src/lib/permission-guard.ts apps/api/src/lib/permission-guard.test.ts apps/api/src/dev/mutate-endpoint.ts apps/api/src/dev/mutate-endpoint.test.ts apps/api/src/index.ts` 確認 lint clean
- [x] 6.4 跑 `bunx oxfmt --check apps/api/src/lib/permission-guard.ts apps/api/src/lib/permission-guard.test.ts apps/api/src/dev/mutate-endpoint.ts apps/api/src/dev/mutate-endpoint.test.ts` 確認格式 clean
- [x] 6.5 確認 coverage：`bun test --coverage` 對 `apps/api/src/lib/permission-guard.ts` 達 100%（純函式，無 DB / IO 分支需要排除）
