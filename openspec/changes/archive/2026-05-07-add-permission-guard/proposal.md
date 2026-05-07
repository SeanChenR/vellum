## Why

Phase 2 即將上線多個 server-side AI 寫入端點（M13/M14：agent endpoint、shape mutation pipeline）。這些端點必須在執行任何 canvas 寫入前回答同一個問題：「這個請求者是不是『已登入』且在這張 canvas 上具有 Owner 或 Editor 角色？」目前 codebase 裡：

- `apps/api/src/lib/permission.ts` 的 `canAccess()` 是純粹的 boolean predicate，不負責產生 HTTP-shape 的 401/403/404 + i18n errorKey 決策樹，也不知道 canvas 是否存在。
- `apps/api/src/sync/auth.ts` 的 `authenticateSyncHandshake()` 把 cookie/token 雙路徑、handshake 訊息流綁在一起，只服務 WebSocket。
- M12.1 留下的 dev mutate 端點（`apps/api/src/dev/mutate-endpoint.ts`）目前是用 `NODE_ENV !== "production"` 物理隔離 — 它沒有真正的 per-request 授權檢查，這在 phase 2 production AI 端點上線前必須補齊。

我們需要一個小但專屬的 **Permission Guard 模組**，獨佔回答「(session, canvasId, allowed-roles) → 401/403/404 + errorKey 或 ok」這個決策，讓未來 AI 寫端點 import 一行 `requireRole(...)` 就能正確收口。

對應 GitHub Issue #7（M12.3），blocked-by #4（M12.1，已完成）。Phase 2 PRD（Issue #2）user stories 24–26 明確指定：共享 Editor 跟 Owner 一樣有 AI 權限；共享 Viewer 不能用 AI；匿名 public-link 訪客（view 或 edit mode）也不能用 AI — Permission Guard 就是把這條規則機械化的地方。

## What Changes

- **新增** `apps/api/src/lib/permission-guard.ts`：
  - 匯出 `type CanvasRole = "owner" | "editor" | "viewer" | "anon"`、`PermissionGuardDeps`（單一相依：`resolveCanvasRole(userId, canvasId)`）、`RequireRoleResult`、`requireRole(deps, session, canvasId, allowed)` 函式。
  - 行為矩陣涵蓋 5 個分支：(a) `session === null` → 401 `errors.auth.unauthorized`；(b) `canvasExists === false` → 404 `errors.canvas.notFound`；(c) authenticated user `role === null` → 403 `errors.canvas.forbidden`；(d) `role` 不在 `allowed` 內 → 403 `errors.canvas.forbidden`；(e) `role` 在 `allowed` 內 → `{ ok: true }`。
  - **不重複** `apps/api/src/sync/auth.ts` 已有的 role 解析邏輯 — Production 透過 `PermissionGuardDeps.resolveCanvasRole` 注入同一個 sync server 在用的 resolver；測試注入 stub。
- **新增** `apps/api/src/lib/permission-guard.test.ts`：單元測試覆蓋 5 個矩陣分支 × 多個 allowed 組合，每個 scenario 一個 `[P]` 平行可寫的 test block。
- **修改** `apps/api/src/dev/mutate-endpoint.ts`：在 rate-limit 之後、`applyMutation` 之前插入一次 `requireRole(deps, session, canvasId, ["owner", "editor"])`；若 `ok === false` 就以對應 status + `{ ok: false, errorKey }` 回應。`DevMutateDeps` 介面新增 `permissionGuard: PermissionGuardDeps`（注入點）。
- **修改** `apps/api/src/dev/mutate-endpoint.test.ts`：擴增四組 case — viewer 拿 403、editor 拿 200、null session 拿 401、未知 canvas 拿 404；既有 happy-path / error-mapping / rate-limit 測試保留並改用 stub guard。
- 對應 PRD Phase 2 user stories 24（Editor 等同 Owner 享有 AI 權限）、25（Viewer 看不到 / 不能用 AI）、26（匿名 public-link 訪客不能用 AI）。

## Non-Goals

- **不**新增 production AI 端點（M13/M14 的責任，本 change 只交付可被 import 的 guard）。
- **不**修改 `apps/api/src/sync/auth.ts` 的 role resolver 或 WebSocket handshake — sync handshake 已經透過同一個 resolver 做自己的 role check，Permission Guard 只是另一個 caller。
- **不**新增 i18n errorKey — 沿用 `packages/shared/src/api-contract.ts` 已存在的 `errors.auth.unauthorized` / `errors.canvas.notFound` / `errors.canvas.forbidden`。
- **不**擴充 `apps/api/src/lib/permission.ts` 的 `canAccess()` predicate — 它服務既有 share REST routes 的純 boolean 用途；Permission Guard 是不同 abstraction（HTTP-shape 決策 + canvas 存在性 + i18n key），同源擴充會把兩個關注點塞進同一個函式。
- **不**支援匿名 public-link 訪客（含 `anon` role）— 匿名訪客一律走 `session === null` → 401 分支；這是刻意行為（PRD US 26：匿名 AI 濫用可能性物理上為零）。
- **不**做 retrofit production rate limit — 本 change 只新增 guard 與 dev endpoint 的整合，rate-limit rule 已存在不需改動。

## Capabilities

### New Capabilities

- `permission-guard`: HTTP-shape 授權守門模組，輸入 (session, canvasId, allowed roles)，輸出 `{ ok: true }` 或 `{ ok: false, status, errorKey }` 決策；給 phase 2 寫入側 AI 端點當共用入口。

### Modified Capabilities

<!-- 無：本 change 不改既有 spec 的 requirements。dev mutate 端點是內部實作整合，沒有改 server-mutation-bridge 的 spec-level requirements。 -->

## Impact

**新增 code**：

- `apps/api/src/lib/permission-guard.ts`
- `apps/api/src/lib/permission-guard.test.ts`

**修改 code**：

- `apps/api/src/dev/mutate-endpoint.ts`（在 handler 中加 `requireRole` 呼叫；`DevMutateDeps` 新增 `permissionGuard` 欄位）
- `apps/api/src/dev/mutate-endpoint.test.ts`（新增 viewer/editor/anon-session/unknown-canvas 四組 test，既有 case 注入 always-allow stub）
- `apps/api/src/index.ts`（dev endpoint 路由註冊處，傳入 `permissionGuard: { resolveCanvasRole: <既有 sync resolver> }`）

**新增 specs**：

- `openspec/specs/permission-guard/spec.md`

**Dependencies / APIs**：

- 不新增 npm 套件。
- 不新增環境變數。
- 不新增 i18n key。
- 沿用既有 `apps/api/src/sync/auth.ts::resolveCanvasRole` 的型別語意（`{ canvasExists, role }`）。
