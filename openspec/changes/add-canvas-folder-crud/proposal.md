## Why

Phase 1 PRD US #9-16（Dashboard / Canvas 管理段）需要落地——使用者登入後第一個會看到的就是 dashboard，而 dashboard 的價值仰賴底下的 canvas + folder CRUD 與「我的 canvases / Shared with me」兩區。沒有這層持久層與基本管理操作，後續的 canvas 編輯器、sharing、export 等 milestone 都無從掛載。

此外，這個 change 也建立了兩個下游 capability 將會仰賴的契約面：(1) `canvases` 資料表（含 `snapshot jsonb`、`owner_id`、`folder_id` nullable）讓 add-canvas-editor-shell 之後可以掛 tldraw 持久化；(2) `apps/api/src/lib/permission.ts` 的 `canAccess(user, canvas, action)` shell（簽名先定、實作由 add-sharing 完成）讓 dashboard 的「Shared with me」查詢與所有 canvas 路由的權限檢查能編譯通過。

## What Changes

涵蓋 PRD US #9-16：

- **新增 Drizzle 資料表**：`folders`（id, owner_id, name, created_at, updated_at）與 `canvases`（id, owner_id, folder_id nullable, title, snapshot jsonb, created_at, updated_at）。Schema 寫在 `apps/api/src/db/schema.ts`，並產出第一份 migration。
- **新增 REST endpoints**（全部走 better-auth session 認證；新建立 endpoint 都帶 rate-limit 規則）：
  - `POST /api/canvas`、`GET /api/canvas`、`GET /api/canvas/:id`、`PATCH /api/canvas/:id`、`DELETE /api/canvas/:id`
  - `POST /api/folder`、`GET /api/folder`、`PATCH /api/folder/:id`、`DELETE /api/folder/:id`
- **新增 Permission shell**：`apps/api/src/lib/permission.ts` 匯出 `canAccess(user, canvas, action)`。Phase 1 only-owner 規則先在這個 change 落地（owner 對自己的 canvas 全動作允許；其他人一律拒絕）；shared/public 邏輯由 add-sharing 補完。
- **新增 API contract 層**：`packages/shared/src/api-contract.ts` 用 zod schema 同時當 server validation source 與 client request type，errorKey 用統一 enum。
- **新增 Dashboard 前端**：
  - `/dashboard` 路由（受 better-auth 保護，未登入跳 `/login`）
  - 「我的 canvases」與「Shared with me」兩區 list view
  - `CanvasCard` 元件（顯示 title、最後編輯時間、placeholder 縮圖）
  - `FolderTree` 元件（1 層 only，支援 Drag canvas 進 / 出 folder）
  - 新建 / 重新命名 / 刪除 canvas 與 folder 的對應 dialog（互動邏輯走 TDD；視覺走預覽迭代）
- **新增 i18n 字串**：`packages/shared/locales/{zh-TW,en}.json` 同步加入 dashboard、folder、canvas CRUD 的所有 UI string 與 errorKey 翻譯。
- **defensive UX**：folder 內若仍有 canvas，DELETE 不 cascade，而是回 errorKey `errors.folder.notEmpty`，要求前端先把 canvas 重新指派到別處。

## Non-Goals

design.md 預期跳過（schema + REST CRUD + 已預留的 deep module shells 都是低不確定度），因此此處列出明確排除範圍：

- **Sharing UI / sharing schema migration**：`canvas_shares` 與 `canvas_share_links` 表的 schema 與 endpoint 由 add-sharing 擁有。本 change 只在「Shared with me」list 查詢時把 `canvas_shares` 當成 read-only 介面假設（join 邏輯先以 type interface 方式宣告，實際 join 在 add-sharing 落地後才會回傳資料；phase 1 dashboard 此區可先呈現空狀態）。
- **Canvas 編輯器**：`/canvas/:id` 路由、tldraw 整合、Vellum chrome 由 add-canvas-editor-shell 負責。本 change 僅做到 dashboard 內可開啟 canvas 詳情，不負責進入編輯介面。
- **縮圖產生**：phase 1 list view 用 placeholder 圖（純 CSS / 漸層背景），等 add-export 落地後才從 canvas snapshot SVG 抽 thumbnail。`canvases` 表不加 `thumbnail` 欄位。
- **Multi-level folder**：PRD US #13 明確只做 1 層；`folders` 表不加 `parent_id` 欄位，前端 `FolderTree` 假設深度恆等於 1。
- **Folder 級 sharing**：分享單位永遠是 canvas，folder 只是 owner 私有的整理 metadata。`folders` 表不接 share 表。
- **Owner 轉移 / 離開自己 canvas**：PRD 已定義 owner 不可離開自己 canvas；本 change DELETE 規則為「owner 自己刪」即可，沒有 transfer ownership endpoint。
- **OOS guard 涵蓋項**：Mobile（< 768px）、活動 log、版本歷史、Sentry / Analytics 等 phase 2+ 項目不進此 change。

## Capabilities

### New Capabilities

- `canvas-management`: Canvas 的 CRUD、owner 持久化、permission shell，以及「我的 canvases / Shared with me」list view 行為（list 端讀取與排序規則屬此 capability；read-only 對 sharing schema 的介面假設亦在此處宣告）。
- `folder-management`: Folder 的 CRUD（1 層深度限制）、與 canvas 的 nullable FK 關係、folder 不為空時 DELETE 拒絕的 defensive UX 規則。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 capability `canvas-management`、`folder-management`
- Affected code:
  - New:
    - apps/api/src/canvas/index.ts
    - apps/api/src/canvas/canvas.test.ts
    - apps/api/src/folder/index.ts
    - apps/api/src/folder/folder.test.ts
    - apps/api/src/lib/permission.ts
    - apps/api/src/lib/permission.test.ts
    - apps/web/src/dashboard/DashboardPage.tsx
    - apps/web/src/dashboard/DashboardPage.test.tsx
    - apps/web/src/dashboard/useCanvasList.ts
    - apps/web/src/dashboard/useFolderList.ts
    - apps/web/src/components/CanvasCard.tsx
    - apps/web/src/components/CanvasCard.test.tsx
    - apps/web/src/components/FolderTree.tsx
    - apps/web/src/components/FolderTree.test.tsx
    - apps/web/src/components/CanvasCreateDialog.tsx
    - apps/web/src/components/CanvasRenameDialog.tsx
    - apps/web/src/components/CanvasDeleteDialog.tsx
    - apps/web/src/components/FolderCreateDialog.tsx
    - apps/web/src/components/FolderRenameDialog.tsx
    - apps/web/src/components/FolderDeleteDialog.tsx
    - packages/shared/src/api-contract.ts
    - apps/api/drizzle/0002_canvas_folder.sql
  - Modified:
    - apps/api/src/db/schema.ts
    - apps/api/src/index.ts
    - apps/web/src/router.tsx
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
    - packages/shared/src/index.ts
  - Removed: (none)
