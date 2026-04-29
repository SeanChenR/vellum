## 1. Schema 與 FK 約束（Drizzle + Migration 路徑）

- [x] 1.1 在 `apps/api/src/db/schema.ts` 新增 `folders` 表（id uuid pk default `gen_random_uuid()`、`owner_id` uuid not null FK → `users.id` ON DELETE CASCADE、`name` text not null、`created_at` / `updated_at` timestamptz default `now()`），落地「Folder schema enforces 1-level depth」要求中「不含 parent_id」的部分
- [x] 1.2 在 `apps/api/src/db/schema.ts` 新增 `canvases` 表（id uuid pk、`owner_id` uuid not null FK → `users.id` ON DELETE CASCADE、`folder_id` uuid nullable FK → `folders.id` ON DELETE SET NULL、`title` text not null、`snapshot` jsonb not null default `'{}'::jsonb`、`created_at` / `updated_at` timestamptz），同時滿足「Canvas creation」與「Folder schema enforces 1-level depth」要求中「ON DELETE SET NULL」的部分
- [x] 1.3 在 `apps/api/src/db/schema.ts` 加索引 `(owner_id, updated_at desc)`（canvases 的 dashboard list 主排序用，支援「Canvas list query with scope filter」中的排序情境）
- [x] 1.4 [P] 寫 schema unit test 驗證 `folders` 不含 `parent_id` 欄位、`canvases.folder_id` nullable 且 ON DELETE SET NULL（覆蓋「Folder schema enforces 1-level depth」兩個 scenario）
- [x] 1.5 跑 `bunx drizzle-kit generate` 產出 `apps/api/drizzle/0002_canvas_folder.sql`，人工 review 該 SQL 內容後 commit；不允許手寫或事後編輯該 SQL 檔（落地「Migration 路徑」決策）
- [x] 1.6 在 dev 機 `bunx drizzle-kit migrate` 套用 0002 migration，並在本地 psql / studio 確認兩張表存在、欄位與 FK 行為符合

## 2. Permission shell：先簽名，後實作（Tests First）

- [x] 2.1 [P] 在 `apps/api/src/lib/permission.test.ts` 寫 unit test 涵蓋「Permission contract for canvas actions」三個 scenario（owner 對 read/write/delete/share 全 true、非 owner 全 false、anonymous user 全 false）
- [x] 2.2 在 `apps/api/src/lib/permission.ts` 實作 `canAccess(user, canvas, action)`，phase 1 規則為 `user?.id === canvas.ownerId` 對所有 action 回 true，否則 false；export `CanvasAction` 型別 `'read' | 'write' | 'delete' | 'share'`（落地「Permission shell：先簽名，後實作」決策與「Permission contract for canvas actions」要求）
- [x] 2.3 [P] 跑 `bun test apps/api/src/lib/permission.test.ts` 確認綠燈

## 3. API contract（zod schema 與 errorKey 列舉）

- [x] 3.1 [P] 在 `packages/shared/src/api-contract.ts` 新增 zod schemas：`canvasCreateInputSchema`（title 1-120、folderId optional uuid|null）、`canvasUpdateInputSchema`（title 1-120 optional、folderId optional uuid|null）、`folderCreateInputSchema`（name 1-80）、`folderUpdateInputSchema`（name 1-80）、列舉 type `ErrorKey`（含 `errors.auth.unauthorized`、`errors.canvas.notFound`、`errors.canvas.forbidden`、`errors.folder.notFound`、`errors.folder.forbidden`、`errors.folder.notEmpty`、`errors.validation`、`errors.rateLimit`、`errors.internal`）（落地「Error envelope 與 errorKey 命名」決策）
- [x] 3.2 [P] 在 `packages/shared/src/api-contract.ts` 同檔匯出 response envelope 型別：`ApiSuccess<T> = { data: T, meta?: { total: number } }`、`ApiFailure = { error: ErrorKey, retryAfter?: number, details?: unknown }`
- [x] 3.3 在 `packages/shared/src/index.ts` re-export api-contract 模組
- [x] 3.4 [P] 寫 unit test `packages/shared/src/api-contract.test.ts` 驗證 zod schema 拒絕邊界（空字串、超長字串、非 uuid folderId）

## 4. Rate limit 規則表（middleware）

- [x] 4.1 在 `apps/api/src/lib/rate-limit-rules.ts` 新增本 change 的 9 條規則常數（`canvas:create` 10/60s、`canvas:update` 60/60s、`canvas:delete` 30/60s、`canvas:list` 60/60s、`canvas:read` 100/60s、`folder:create` 10/60s、`folder:update` 30/60s、`folder:delete` 10/60s、`folder:list` 60/60s），落地「Rate limit 規則表」決策
- [x] 4.2 [P] 寫 integration test 驗證任一 POST endpoint 在第 11 次請求於 60 秒內回 429 並帶 `Retry-After` header（覆蓋 spec 中 Canvas creation 與 Folder creation 的 rate limit 情境）

## 5. Canvas REST endpoints — Tests First

- [ ] 5.1 [P] 在 `apps/api/src/canvas/canvas.test.ts` 寫 integration test 覆蓋「Canvas creation」全部 scenario（成功在 root、成功在自己 folder、folder 屬他人 403、title 驗證、未認證、rate limit）
- [ ] 5.2 [P] 寫 integration test 覆蓋「Canvas list query with scope filter」全部 scenario（owned scope sort by updatedAt desc、folderId 過濾、folderId=null unfiled、scope=shared 短路回空、未認證）
- [ ] 5.3 [P] 寫 integration test 覆蓋「Canvas read by id」全部 scenario（owner 200、非 owner 403、不存在 404）
- [ ] 5.4 [P] 寫 integration test 覆蓋「Canvas update (rename and folder reassignment)」全部 scenario（rename、move 進自己 folder、move 出至 null、move 進他人 folder 403、非 owner 403、validation 400）
- [ ] 5.5 [P] 寫 integration test 覆蓋「Canvas delete」全部 scenario（owner 204、非 owner 403、不存在 404）

## 6. Canvas REST endpoints — Implementation

- [ ] 6.1 在 `apps/api/src/canvas/index.ts` 實作 `POST /api/canvas`，套用 better-auth session middleware、`canAccess` 檢查（建立時改驗 folderId 屬該 user）、`canvasCreateInputSchema` 驗 body、套用 rate limit `canvas:create`（落地「Canvas creation」要求）
- [ ] 6.2 在 `apps/api/src/canvas/index.ts` 實作 `GET /api/canvas`，支援 `scope=owned|shared` 與 `folderId=<uuid>|null` 兩個 query；`scope=shared` 在本 change 永遠 short-circuit 回 `{ data: [], meta: { total: 0 } }` 並在程式碼中加 `// TODO(add-sharing): remove short-circuit` 註解（落地「Shared with me」list 的 forward-compat 介面決策與「Canvas list query with scope filter」要求）
- [ ] 6.3 在 `apps/api/src/canvas/index.ts` 實作 `GET /api/canvas/:id`，先 fetch row、再走 `canAccess(user, canvas, 'read')`；`canvas:read` rate limit 設 100/60s（落地「Canvas read by id」要求）
- [ ] 6.4 在 `apps/api/src/canvas/index.ts` 實作 `PATCH /api/canvas/:id`，驗 `canvasUpdateInputSchema`、`canAccess(user, canvas, 'write')`、若帶 folderId 額外驗 folder ownership、更新 `updated_at`（落地「Canvas update (rename and folder reassignment)」要求）
- [ ] 6.5 在 `apps/api/src/canvas/index.ts` 實作 `DELETE /api/canvas/:id`，`canAccess(user, canvas, 'delete')`，回 204 no body（落地「Canvas delete」要求）
- [ ] 6.6 在 `apps/api/src/index.ts` 掛載 canvas routes 並 wire rate-limit middleware；確認 5.1-5.5 全測試綠燈

## 7. Folder REST endpoints — Tests First

- [ ] 7.1 [P] 在 `apps/api/src/folder/folder.test.ts` 寫 integration test 覆蓋「Folder creation」全部 scenario（成功、name 驗證、未認證、rate limit）
- [ ] 7.2 [P] 寫 integration test 覆蓋「Folder list query」全部 scenario（owned 排序 ascending by name、未認證）
- [ ] 7.3 [P] 寫 integration test 覆蓋「Folder rename」全部 scenario（owner 200、非 owner 403、不存在 404、validation 400）
- [ ] 7.4 [P] 寫 integration test 覆蓋「Folder delete with non-empty guard」全部 scenario（empty 204、non-empty 409、非 owner 403、不存在 404）

## 8. Folder REST endpoints — Implementation

- [ ] 8.1 在 `apps/api/src/folder/index.ts` 實作 `POST /api/folder`，session + `folderCreateInputSchema` + rate limit `folder:create`（落地「Folder creation」要求）
- [ ] 8.2 在 `apps/api/src/folder/index.ts` 實作 `GET /api/folder`，回 owner 自己的 folder list、name asc 排序（落地「Folder list query」要求）
- [ ] 8.3 在 `apps/api/src/folder/index.ts` 實作 `PATCH /api/folder/:id`，owner 檢查 + `folderUpdateInputSchema` + 更新 `updated_at`（落地「Folder rename」要求）
- [ ] 8.4 在 `apps/api/src/folder/index.ts` 實作 `DELETE /api/folder/:id`，owner 檢查、count canvases where folder_id = id；若 > 0 回 409 `errors.folder.notEmpty`，否則 204（落地「Folder delete with non-empty guard」要求）
- [ ] 8.5 在 `apps/api/src/index.ts` 掛載 folder routes；確認 7.1-7.4 全測試綠燈

## 9. i18n locale 同步（zh-TW + en）

- [ ] 9.1 [P] 在 `packages/shared/src/locales/zh-TW.json` 新增 dashboard / canvas / folder UI 字串：`dashboard.myCanvases`、`dashboard.sharedWithMe`、`dashboard.createCanvas`、`dashboard.empty.owned`、`dashboard.empty.shared`、`canvas.card.lastEdited`、`canvas.card.menu.rename`、`canvas.card.menu.move`、`canvas.card.menu.delete`、`canvas.dialog.create.title`、`canvas.dialog.rename.title`、`canvas.dialog.delete.title`、`canvas.dialog.delete.confirm`、`folder.allCanvases`、`folder.unfiled`、`folder.create`、`folder.rename`、`folder.delete`、`folder.deleteConfirm`、以及全部 9 條 errorKey 翻譯（落地「Localized strings synchronized across zh-TW and en」與「Localized strings for folder UI synchronized across zh-TW and en」要求中 zh-TW 一側）
- [ ] 9.2 [P] 在 `packages/shared/src/locales/en.json` 同步加入 9.1 的全部 key 與英文翻譯（落地兩個 i18n 同步要求中 en 一側）
- [ ] 9.3 [P] 寫 unit test `packages/shared/src/locales/locales.test.ts` 驗證 zh-TW 與 en 兩 JSON 的 key 集合完全相同（防止單語漂移）

## 10. 前端架構：dashboard 用 TanStack Query 為 source of truth — Hooks 與 Tests

- [ ] 10.1 [P] 在 `apps/web/src/dashboard/useCanvasList.ts` 寫 `useCanvasList(scope, folderId)` hook，包 `GET /api/canvas` query、回 `Canvas[]`，rename / delete / move 用 useMutation + invalidateQueries（落地「前端架構：dashboard 用 TanStack Query 為 source of truth」決策）
- [ ] 10.2 [P] 在 `apps/web/src/dashboard/useFolderList.ts` 寫 `useFolderList()` hook，包 `GET /api/folder` 的 query 與 create/rename/delete mutation
- [ ] 10.3 [P] 寫 hook test 驗證 useCanvasList 的 invalidateQueries 在 mutation 成功後重新觸發 list refetch

## 11. 前端：Dashboard、CanvasCard、FolderTree 互動行為（Tests First）

- [ ] 11.1 [P] 寫 component test `apps/web/src/dashboard/DashboardPage.test.tsx` 覆蓋「Dashboard canvas list view」全部 scenario（兩 heading 渲染、empty owned、empty shared、unauthenticated 重導向 /login）
- [ ] 11.2 [P] 寫 component test `apps/web/src/components/CanvasCard.test.tsx` 覆蓋「Canvas card displays metadata」全部 scenario（render 標題與 last-edited、context menu 開 rename dialog、context menu 開 delete dialog）
- [ ] 11.3 [P] 寫 component test `apps/web/src/components/FolderTree.test.tsx` 覆蓋「Folder tree component renders flat list with drag targets」全部 scenario（5 行順序：All canvases / Unfiled / A / B / C、drop CanvasCard 觸發 PATCH `{folderId}`、drop 到 Unfiled 觸發 `folderId: null`、click folder 行觸發 list 重 query）

## 12. 前端：Dashboard、CanvasCard、FolderTree 元件實作

- [ ] 12.1 在 `apps/web/src/components/CanvasCard.tsx` 實作元件：title、localized 相對時間（用 i18next plural / Intl.RelativeTimeFormat）、placeholder 縮圖（純 CSS 漸層）、context menu 三個 action（落地「Canvas card displays metadata」要求；視覺走預覽迭代不上 TDD）
- [ ] 12.2 在 `apps/web/src/components/FolderTree.tsx` 實作 1 層 flat list（含 synthetic「All canvases」/「Unfiled」），每個 folder row 為 dnd-kit drop target，click row 改變 dashboard 的 folder filter state（落地「Folder tree component renders flat list with drag targets」要求；視覺走預覽迭代）
- [ ] 12.3 在 `apps/web/src/components/CanvasCreateDialog.tsx` / `CanvasRenameDialog.tsx` / `CanvasDeleteDialog.tsx` 實作三個 dialog（react-hook-form + zod；delete 為破壞性，無 optimistic update）
- [ ] 12.4 在 `apps/web/src/components/FolderCreateDialog.tsx` / `FolderRenameDialog.tsx` / `FolderDeleteDialog.tsx` 實作三個 dialog；delete dialog 處理 `errors.folder.notEmpty` 顯示「請先把 canvas 移出此 folder」訊息
- [ ] 12.5 在 `apps/web/src/dashboard/DashboardPage.tsx` 組合 FolderTree + CanvasCard 列表 + 兩區（My Canvases / Shared with me），用 useCanvasList(scope='owned') 與 useCanvasList(scope='shared') 拉資料；pass 11.1 全測試（落地「Dashboard canvas list view」要求）

## 13. Routing 與認證守衛

- [ ] 13.1 在 `apps/web/src/router.tsx` 註冊 `/dashboard` 路由 component 為 DashboardPage，beforeLoad 走 better-auth session 檢查；未登入 throw redirect 到 `/login`（落地「Dashboard canvas list view」中 unauthenticated 重導向 scenario）
- [ ] 13.2 [P] 寫 router test 驗證未認證進 `/dashboard` 導向 `/login`、已認證可進

## 14. 完成驗證與覆蓋率

- [ ] 14.1 跑 `bun test --coverage` 確認本 change 內 logic 區塊（permission、api-contract、canvas/folder routes、hooks、locales 同步）≥ 70% 覆蓋率
- [ ] 14.2 [P] 跑 `bunx oxlint` 與 `bunx oxfmt --check` 確認無 lint / format 問題
- [ ] 14.3 [P] 跑 `bun run typecheck` 確認 TypeScript 全綠
- [ ] 14.4 在 dev 機開本地伺服器（用 tmux 啟動 dev script），手動 walk-through 五條互動：建立 canvas、rename、建立 folder、drag 進 folder、刪除 folder（先空再非空），完成「視覺走預覽迭代」的 visual approval
