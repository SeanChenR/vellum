## Why

Vellum 的核心價值是「以 tldraw SDK 為底、披上 Vellum chrome、感覺像正式產品的 canvas 協作工具」（PRD §Solution、ADR-0005）。在 `add-auth` 完成 login／route guard 與 `add-canvas-folder-crud` 完成 canvas 資料表之後，使用者點開一張 canvas 必須真的進入到一個**可編輯、有 Vellum 自家頂部 bar、有自家 File-style 主選單、編輯內容會被自動持久化**的工作區——否則 dashboard 上的「開啟」按鈕就只是個死連結，整個 phase 1 縱切無法銜接。

這個 change 把 PRD §Canvas 編輯體驗段中**屬於「殼」的三條 user story**（US #17 Vellum chrome、US #18 tldraw 內建工具可用、US #23 自動持久化）獨立交付，先把空殼立起來；後續 `add-shape-framework` 與 `add-shape-markdown / code / callout / link-card` 在這個殼上掛 4 個 custom shape（PRD US #19–#22），`add-multiplayer-sync` 則接手把 phase 1 的 localStorage 持久化換成 tldraw sync over Bun WebSocket（PRD US #24–#29、US #23 的多端版本）。Sharing UI（US #27 同伴頭像、US #30–#37）會在 `add-sharing` 內補上對話框邏輯，本 change 僅在 TopBar 上預留一個**非功能版的 Share 按鈕 placeholder**（點下會觸發 `onShareClick` callback，先掛一個 toast「分享功能尚未啟用」）。

## What Changes

涵蓋 PRD US #17（Vellum chrome 取代 tldraw 預設 UI）、US #18（保留 tldraw 內建工具）、US #23（編輯自動持久化）：

- 新增 `/canvas/:id` 路由（`apps/web/src/router.tsx` 修改）；route guard 沿用 `add-auth` 提供的機制（未登入導向 `/login`），canvas 是否存在、使用者是否有權限的檢查交由 `add-canvas-folder-crud` 提供的 query；本 change 假設 canvas 已存在且使用者有編輯權限，404 / 403 落地處理由前述兩個 change 負責。
- 新增 `apps/web/src/canvas/CanvasPage.tsx` 作為路由元件：抓取 canvas metadata（title / id），render `<Editor>`。
- 新增 `apps/web/src/canvas/Editor.tsx`：使用 tldraw SDK 的 `<Tldraw>` 元件，傳入 `components={{ TopPanel, MainMenu, ... }}` 替換預設 chrome；保留 tldraw 內建的右側／底部 toolbar、shape 工具、選取／變形／對齊／undo／鍵盤捷徑（ADR-0005 整合層級 c）；single-page document（不啟用 tldraw multi-page，PRD §Out of Scope）；保留 tldraw 浮水印（phase 1 free license 合規，ADR-0005 §Negative）。
- 新增 `apps/web/src/chrome/TopBar.tsx`：包含 logo、canvas title（可點擊重新命名）、folder breadcrumb（顯示所屬 folder 名稱，無 folder 時顯示「My canvases」）、Share 按鈕 placeholder（按下顯示 toast「分享功能尚未啟用」，待 `add-sharing` 接手）、user menu（沿用 `add-auth` 提供的 `useAuth` hook 顯示頭像 + 登出）。
- 新增 `apps/web/src/chrome/MainMenu.tsx`：File-style 下拉選單，包含「重新命名」、「複製」、「刪除」、以及「匯出」子選單佔位（子選單項目顯示「敬請期待」字樣，待 `add-export` 接手）；複製／刪除動作呼叫 `add-canvas-folder-crud` 提供的 mutation hooks。
- 新增 `apps/web/src/chrome/index.tsx`：將 `TopBar` 與 `MainMenu` 組合成 tldraw `components` prop 接受的物件（`{ TopPanel: () => <TopBar />, MainMenu: () => <VellumMainMenu />, ... }`），其餘 chrome 槽位（SharePanel、HelpMenu）顯式設為 `null` 以隱藏 tldraw 預設項。
- 新增 `apps/web/src/canvas/persistence.ts` deep module：localStorage 適配器，`loadSnapshot(id) → Snapshot | null` 與 `saveSnapshot(id, snapshot) → Result<void, PersistError>`；key 命名格式 `vellum:canvas:<id>:snapshot`；序列化用 `JSON.stringify`；明確處理 (a) 不存在的 key、(b) malformed JSON、(c) 反序列化後 schema 不符、(d) `QuotaExceededError`、(e) snapshot 體積超過 5MB cap（pre-write 檢查避免直接 throw quota error）；明確標記為「phase 1 暫時方案」，server-side sync 由 `add-multiplayer-sync` 接手取代。
- 新增 autosave hook：在 `Editor.tsx` 內訂閱 tldraw editor 的 `store.listen()`，以 800ms debounce 將 snapshot 寫入 `saveSnapshot(canvasId, snapshot)`；首次掛載時讀 `loadSnapshot(canvasId)` 注入 tldraw 初始 state；quota exceeded 時顯示一次性 toast「本地儲存空間已滿，請匯出後清理」並停止後續寫入直到使用者 reload。
- 新增 `packages/shared/src/shape-types.ts`：custom shape type registry 佔位檔——匯出空陣列 `customShapeUtils: ShapeUtil[] = []` 與註解標明 `add-shape-framework` 將接手填入；同時匯出 `customShapeTools = []` 對稱。
- 修改 `packages/shared/locales/zh-TW.json` 與 `packages/shared/locales/en.json`：新增 `canvas.chrome.*` 命名空間，鍵包含 `topbar.shareButton`、`topbar.sharePlaceholderToast`、`topbar.userMenu.label`、`topbar.breadcrumb.myCanvases`、`mainMenu.label`、`mainMenu.rename`、`mainMenu.duplicate`、`mainMenu.delete`、`mainMenu.export`、`mainMenu.exportComingSoon`、`persistence.quotaExceededToast`、`persistence.loadFailedToast`，以及 `canvas.title.untitled`、`canvas.title.renameDialog.label`、`canvas.title.renameDialog.confirm`、`canvas.title.renameDialog.cancel`；zh-TW + en 同步加（CLAUDE.md hard rule 2）。
- 修改 `apps/web/package.json`：加入 `tldraw` dependency（latest stable）。
- 動畫紀律（CLAUDE.md hard rule 5）：MainMenu 下拉、rename dialog enter/exit、Share placeholder toast 走 motion；canvas 區內部不加任何 motion。

## Non-Goals (optional)

- **不做**任何 custom shape 的 ShapeUtil 實作 — Markdown / Code / Callout / Link card 全部交給後續 `add-shape-framework` 與 4 個 `add-shape-*` change（PRD US #19–#22）。本 change 的 `customShapeUtils` 是空陣列佔位。
- **不做** server-side 的 canvas snapshot 持久化 — phase 1 本 change 用 localStorage（≤5MB cap，per canvas id）。Server snapshot 寫入 Postgres jsonb 與 tldraw sync WebSocket 接管由 `add-multiplayer-sync` 處理。離開這個 change 時，整個多人協作仍未啟用，`<Tldraw>` 在單機模式運行（store 不掛 sync provider）。
- **不做** 任何 sharing UI 邏輯 — TopBar 上的 Share 按鈕只是一個觸發 toast 的 placeholder。完整 ShareDialog（invite form、link mode 三檔切換、rotate）由 `add-sharing` 接手（PRD US #30–#37）。
- **不做** multiplayer cursor／presence avatars list — US #25 / #27 屬於 `add-multiplayer-sync`。本 change 的 TopBar 沒有「目前線上協作者」區塊。
- **不做** 任何 export 功能 — MainMenu 的「匯出」子選單只是 placeholder 顯示「敬請期待」。實際 PNG / SVG / PDF / JSON / Markdown 由 `add-export` 接手（PRD US #38–#44）。
- **不做** tldraw multi-page — 顯式以 `maxPages={1}` 或等價設定鎖定 single-page（PRD §Out of Scope）。
- **不做** tldraw watermark 移除 — phase 1 保留浮水印，phase 2 才評估申請 free commercial license（ADR-0005、ADR-0002）。
- **不做** 圖片上傳到 cloud — tldraw 內建 image shape 用 base64 / object URL 即可（PRD §Out of Scope）。
- **不做** mobile（<768px）適配 — chrome 視覺只針對 ≥768px 優化（PRD §Out of Scope）。
- **不做** version history / activity log（PRD §Out of Scope）。
- **不做** canvas 不存在時的 404 落地頁與「無權限」403 落地頁 — 假設 `add-canvas-folder-crud` 已負責這兩個錯誤路徑。
- **不做** rate limit — 本 change 不新增任何 server endpoint，localStorage autosave 純前端，不適用 RateLimiter（CLAUDE.md hard rule 4 適用範圍是 API endpoint 與 WS）。

## Capabilities

### New Capabilities

- `canvas-editor`: 在已存在的 canvas 上提供 Vellum 客製 chrome（TopBar 含 title／folder breadcrumb／Share placeholder／user menu、File-style MainMenu）、嵌入 tldraw `<Tldraw>` 並保留內建編輯工具、phase 1 以 localStorage 自動持久化單機編輯內容，以及 5MB cap 與 quota exceeded 的 graceful degradation。

### Modified Capabilities

(none)

## Impact

- Affected specs:
  - New: `canvas-editor`
- Affected code:
  - New:
    - apps/web/src/canvas/CanvasPage.tsx
    - apps/web/src/canvas/Editor.tsx
    - apps/web/src/canvas/persistence.ts
    - apps/web/src/canvas/persistence.test.ts
    - apps/web/src/chrome/TopBar.tsx
    - apps/web/src/chrome/TopBar.test.tsx
    - apps/web/src/chrome/MainMenu.tsx
    - apps/web/src/chrome/MainMenu.test.tsx
    - apps/web/src/chrome/index.tsx
    - packages/shared/src/shape-types.ts
  - Modified:
    - apps/web/src/router.tsx
    - apps/web/package.json
    - packages/shared/locales/zh-TW.json
    - packages/shared/locales/en.json
  - Removed: (none)
- Affected dependencies:
  - Add `tldraw` (latest stable) to apps/web dependencies.
- Conceptual upstream dependencies (assumed already implemented by sibling changes; this change does NOT re-implement them):
  - `add-auth` provides `useAuth()` hook + route guard for `/canvas/:id`.
  - `add-canvas-folder-crud` provides canvas metadata query (title, folder), rename / duplicate / delete mutations, plus 404/403 handling.
- Downstream changes that build on this shell:
  - `add-shape-framework` fills `packages/shared/src/shape-types.ts` and wires `customShapeUtils` into `<Tldraw>` props.
  - `add-multiplayer-sync` replaces `apps/web/src/canvas/persistence.ts` localStorage usage with tldraw-sync provider talking to Bun WebSocket.
  - `add-sharing` replaces TopBar's Share placeholder with the real ShareDialog open trigger.
  - `add-export` fills MainMenu's export submenu with real export actions.
