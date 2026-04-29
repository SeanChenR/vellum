> 任務分組對應 CLAUDE.md hard rule 1（TDD-first）：邏輯模組（persistence、chrome 互動、autosave）走 Tests First → Implementation → Refactor 三階段；視覺項（TopBar / MainMenu 樣式、tldraw 嵌入版面）走預覽迭代，明確標記為 *preview-iteration*。`[P]` 表示該任務操作的檔案與同組其他待辦不同、可平行執行（`parallel_tasks: true`）。

## 1. 環境與依賴設置

- [x] 1.1 在 `apps/web/package.json` 的 `dependencies` 加入 `tldraw` 套件（pin 到目前 latest stable 的具體 minor 版本，例如 `"tldraw": "3.x.y"`，避免 caret 範圍導致非預期升級）。這是 spec「Canvas editor route renders Vellum chrome around tldraw」的前置依賴。
- [x] 1.2 [P] 落實設計決策「`customShapeUtils` 與 `customShapeTools` 放在 `packages/shared/src/shape-types.ts`」與 spec「Single-page document and custom shape registry are wired at the integration point」：在 `packages/shared/src/shape-types.ts` 建立 customShape registry 佔位檔——`export const customShapeUtils: ShapeUtil[] = []` 與 `export const customShapeTools: StateNode[] = []`，並於檔案頂部加註解 `// Populated incrementally by add-shape-* changes; intentionally empty in add-canvas-editor-shell.`。從 tldraw SDK import 對應的 `ShapeUtil` 與 `StateNode` 型別。
- [x] 1.3 [P] 在 `packages/shared/locales/zh-TW.json` 與 `packages/shared/locales/en.json` 同步加入 `canvas.chrome.*` 與 `canvas.title.*` 命名空間下的所有鍵：`topbar.shareButton`、`topbar.sharePlaceholderToast`、`topbar.userMenu.label`、`topbar.userMenu.signOut`、`topbar.breadcrumb.myCanvases`、`mainMenu.label`、`mainMenu.rename`、`mainMenu.duplicate`、`mainMenu.delete`、`mainMenu.deleteConfirmTitle`、`mainMenu.deleteConfirmBody`、`mainMenu.deleteConfirmYes`、`mainMenu.deleteConfirmNo`、`mainMenu.export`、`mainMenu.exportComingSoon`、`mainMenu.exportPng`、`mainMenu.exportSvg`、`mainMenu.exportPdf`、`mainMenu.exportJson`、`mainMenu.exportMarkdown`、`persistence.quotaExceededToast`、`persistence.loadFailedToast`、`canvas.title.untitled`、`canvas.title.renameDialog.label`、`canvas.title.renameDialog.confirm`、`canvas.title.renameDialog.cancel`。zh-TW 與 en 鍵集合 MUST 完全相同（覆蓋 spec「All chrome strings are localized in zh-TW and en」要求）。

## 2. Persistence 模組 — Tests First（TDD red）

- [x] 2.1 在 `apps/web/src/canvas/persistence.test.ts` 撰寫 5 條失敗測試覆蓋 spec「Persistence module loads and saves snapshots in localStorage with a 5MB cap」要求：(a) round-trip：write 一個小 payload 後 read 回相同內容；(b) loadSnapshot 對不存在的 key 回 null 不 throw；(c) loadSnapshot 對 malformed JSON（手動塞入非 JSON 字串）回 null 不 throw；(d) saveSnapshot 對 `JSON.stringify(s).length > 5_242_880` 的 payload 回 `{ ok: false, reason: "too_large" }` 且 spy 確認 `localStorage.setItem` 未被呼叫；(e) saveSnapshot 在 `localStorage.setItem` mock throw `QuotaExceededError`（DOMException name "QuotaExceededError"）時回 `{ ok: false, reason: "quota" }` 不 throw。使用 happy-dom 提供的 localStorage 並在 `beforeEach` clear。
- [x] 2.2 [P] 在 `apps/web/src/canvas/persistence.test.ts` 加上 key 命名 round-trip 測試：write `c1` 後讀 `c2` 必回 null；write `c1` 後 inspect localStorage MUST 在 key `vellum:canvas:c1:snapshot` 找到內容。

## 3. Persistence 模組 — Implementation（TDD green）

- [x] 3.1 落實設計決策「`persistence.ts` 是 deep module；介面以 snapshot 為單位」：在 `apps/web/src/canvas/persistence.ts` 實作 `loadSnapshot(canvasId)` 與 `saveSnapshot(canvasId, snapshot)`，key 樣式 `vellum:canvas:<id>:snapshot`、`JSON.stringify` 序列化、5,242,880 bytes pre-write check、try/catch 捕捉 QuotaExceededError 並回 discriminated union。型別 `Snapshot` import 自 tldraw `getSnapshot` 回傳值。檔案頂部明確 JSDoc 註解「phase 1 暫時方案，將由 add-multiplayer-sync 取代」。執行 2.1、2.2 的測試套件直到全綠。

## 4. Persistence 模組 — Refactor

- [x] 4.1 [P] Refactor `persistence.ts`：抽出 `serialize` 與 `deserialize` 私有函式、抽出 `MAX_PAYLOAD_BYTES = 5 * 1024 * 1024` 常數、抽出 `keyFor(canvasId)` helper；保證測試仍全綠；確認檔案 < 100 行（CLAUDE.md coding-style 偏好小檔）。

## 5. Chrome 元件互動 — Tests First（TDD red）

- [x] 5.1 在 `apps/web/src/chrome/TopBar.test.tsx` 撰寫覆蓋 spec「TopBar exposes canvas title, folder breadcrumb, share placeholder, and user menu」的失敗測試：(a) 提供 `folder: { name: "Inbox" }` 的 prop 時 breadcrumb 顯示「Inbox」；(b) 提供 `folder: null` 時 breadcrumb 顯示 i18n key `canvas.chrome.topbar.breadcrumb.myCanvases` 對應的英文文字（測試 wrapper 設 i18n locale 為 en 以斷言實際字串）；(c) 點 Share 按鈕觸發傳入的 `onShareClick` mock 一次；(d) 點 canvas title 開啟 rename dialog（dialog 出現於 DOM 且輸入 focus）；(e) rename dialog 按 Escape 關閉且不呼叫 rename mutation；(f) rename dialog 輸入新名按 Enter 呼叫 rename mutation 一次並關閉 dialog。使用 Testing Library + `userEvent`。
- [x] 5.2 [P] 在 `apps/web/src/chrome/MainMenu.test.tsx` 撰寫覆蓋 spec「MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu」的失敗測試：(a) 開啟 menu 後出現四個 item，順序 Rename / Duplicate / Delete / Export；(b) 點 Rename 觸發 `onRename` mock；(c) 點 Duplicate 觸發 `onDuplicate` mock；(d) 點 Delete 開啟 confirm dialog，confirm 鍵呼叫 `onDelete`、cancel 鍵不呼叫；(e) hover Export 顯示子選單，五個項目 (PNG/SVG/PDF/JSON/Markdown) 都帶有 `aria-disabled="true"` 屬性且文字含 "coming soon" 對應字串。

## 6. Chrome 元件互動 — Implementation（TDD green）

- [x] 6.1 實作 `apps/web/src/chrome/TopBar.tsx`：dumb component，props `{ canvasId, title, folder, onShareClick, onRenameSubmit, currentUser, onSignOut }`；包含 logo 槽、breadcrumb（folder?.name ?? `t('canvas.chrome.topbar.breadcrumb.myCanvases')`）、可點擊 title、Share button（呼叫 `onShareClick`）、user menu（avatar + dropdown 含 sign-out item）。Rename dialog 用 shadcn `Dialog` 元件 + react-hook-form + zod schema (`{ title: z.string().min(1).max(200) }`) 控制送出。所有顯示字串走 `useTranslation()`。執行 5.1 直到全綠。
- [x] 6.2 [P] 落實設計決策「mainmenu 的 export submenu 顯示「敬請期待」而非隱藏」：實作 `apps/web/src/chrome/MainMenu.tsx`，使用 shadcn `DropdownMenu`（基於 Radix），四個 item 順序 Rename / Duplicate / Delete / Export；Delete 觸發 shadcn `AlertDialog` 確認；Export 為 `DropdownMenuSub`，五個 child item 全部 `disabled` 並文字組合 `${t('mainMenu.exportPng')} (${t('mainMenu.exportComingSoon')})` 等（即「敬請期待」佔位文字）。所有字串走 i18n。執行 5.2 直到全綠。
- [x] 6.3 落實設計決策「Wrap `<Tldraw>` with `components` prop, not children-based composition」：實作 `apps/web/src/chrome/index.tsx`，匯出 `vellumChromeComponents` 物件供 `<Tldraw components={...}>` 使用。內容：`TopPanel: () => <TopBar {...propsFromContext} />`、`MainMenu: () => <VellumMainMenu {...propsFromContext} />`、`SharePanel: null`、`HelpMenu: null`、`PageMenu: null`（避免 multi-page 入口）。Props 透過 React context（在 `Editor.tsx` 提供）注入，避免每次重渲染建新閉包。

## 7. Editor 整合與 autosave — Tests First（TDD red）

- [x] 7.1 在 `apps/web/src/canvas/Editor.test.tsx` 撰寫覆蓋 spec「Editor autosaves snapshots on a debounced cadence and on page unload」的失敗測試：(a) mount 時若 `loadSnapshot` mock 回非 null，傳給 tldraw 的初始 store 包含該 snapshot（用 `vi.mocked` 風格的 mock）；(b) mount 時若 `loadSnapshot` 回 null，初始 store 為空；(c) 模擬 store 觸發 5 次 change 事件於 0/100/200/300/400 ms，使用 `bun:test` fake timers 推進到 1200 ms，斷言 `saveSnapshot` 只被呼叫 1 次且傳入最新 snapshot；(d) 觸發 `window.dispatchEvent(new Event('beforeunload'))` 時若有 pending debounced write，`saveSnapshot` MUST 同步呼叫一次；(e) `saveSnapshot` mock 回 `{ ok: false, reason: 'quota' }` 後再次觸發 store change MUST NOT 呼叫 `saveSnapshot`；toast 函式 MUST 只被呼叫一次。
- [x] 7.2 [P] 在 `apps/web/src/canvas/Editor.test.tsx` 加上「Single-page document and custom shape registry」覆蓋：mock `customShapeUtils` 為含一個假 ShapeUtil 的陣列，斷言該陣列被傳入 `<Tldraw shapeUtils={...}>` prop；斷言 `<Tldraw>` 接收到禁用 multi-page 的設定（如 `maxPages={1}` 或等價設定）。

## 8. Editor 整合與 autosave — Implementation（TDD green）

- [x] 8.1 落實設計決策「autosave 用 800ms debounce + tldraw `store.listen`」與 spec「Canvas editor route renders Vellum chrome around tldraw」：實作 `apps/web/src/canvas/Editor.tsx`，接收 `{ canvasId, title, folder, ...mutations }` props；使用 `useState` 載入初始 snapshot（`useState(() => loadSnapshot(canvasId))`，僅 mount 一次）；mount 後呼叫 `editor.store.listen` 註冊 listener；listener 內部以 `setTimeout` + `clearTimeout` 實作 trailing-edge debounce 800 ms；`saveSnapshot` 失敗時設 `quotaBlocked = true` flag、顯示 toast 後 listener 直接 early return；`useEffect` 註冊 `beforeunload` 同步 flush（`clearTimeout` 後同步呼叫 `saveSnapshot`）；卸載時 cleanup listener 與 timer。傳入 `<Tldraw>` 的 props：`shapeUtils={customShapeUtils}`、`tools={customShapeTools}`、`components={vellumChromeComponents}`、`maxPages={1}`、`snapshot={initialSnapshot ?? undefined}`。執行 7.1、7.2 直到全綠。

## 9. Editor 整合與 autosave — Refactor

- [x] 9.1 [P] 抽出 debounce 邏輯到 `apps/web/src/canvas/use-autosave.ts` hook：簽名 `useAutosave(canvasId, getSnapshot)`，內部封裝 listener 註冊、800 ms debounce、quota fail-fast、beforeunload flush。`Editor.tsx` 改成單行 `useAutosave(canvasId, () => getSnapshot(editor.store))`。將 7.1 的測試移到 `use-autosave.test.ts` 重跑全綠。

## 10. CanvasPage 與路由

- [x] 10.1 落實設計決策「Share button 是 placeholder：`onShareClick` callback prop」：實作 `apps/web/src/canvas/CanvasPage.tsx`，作為 route 元件；用 TanStack Router 的 `useParams({ from: '/canvas/$id' })` 取 id；呼叫 `add-canvas-folder-crud` 提供的 `useCanvasQuery(id)` hook 取 metadata；loading 時顯示 spinner、error 時 fallback 給上游 change 的 404/403；成功時 render `<Editor canvasId={id} title={canvas.title} folder={canvas.folder} onRename={...} onDuplicate={...} onDelete={...} onShareClick={() => toast(t('canvas.chrome.topbar.sharePlaceholderToast'))} />`。`onShareClick` callback prop 是 phase 1 唯一的 share 出口（後續 add-sharing 接手）。
- [x] 10.2 [P] 修改 `apps/web/src/router.tsx`：新增 `canvasRoute` (`createRoute({ getParentRoute: () => rootRoute, path: '/canvas/$id', component: CanvasPage })`)，append 進 `routeTree`；保留現有 indexRoute 不動；對 TanStack Router type registry 不需額外動。
- [x] 10.3 在 `apps/web/src/canvas/CanvasPage.test.tsx` 撰寫互動測試：mock 上游 hook 回不同狀態（loading / success / error），斷言三種對應 UI；success case 同時驗證 `onShareClick` 預設 callback 觸發 toast 包含 `canvas.chrome.topbar.sharePlaceholderToast` 文案（覆蓋 spec「Share button placeholder triggers a not-yet-available toast」）。

## 11. 視覺迭代（preview-iteration，非 TDD）

- [x] 11.1 [P] 在 browser 中迭代 TopBar 視覺（Vellum chrome renders Vellum chrome around tldraw）：高度 56px、左側 logo + breadcrumb + title 群組、右側 Share + user menu、底部 1px ink-navy/10 分隔線；font-family 用 Inter（UI），title 用 Newsreader serif accent；間距走 Tailwind 4/6/8 系列；確認與 styles.css 中 brand tokens（ink-navy / parchment-cream / warm-sepia）一致。
- [x] 11.2 [P] 在 browser 中迭代 MainMenu 樣式：DropdownMenu 寬度 ≥ 220px、item padding `py-2 px-3`、disabled item 灰階 50%、submenu 縮排 hint icon。
- [x] 11.3 [P] 在 browser 中迭代 rename dialog 與 delete confirm dialog 視覺：使用 shadcn Dialog/AlertDialog 預設樣式，僅微調品牌色；motion enter/exit 走 fade + 4px y 位移、duration 180 ms（覆蓋 spec「Chrome animations use motion; canvas region uses none」要求）。
- [x] 11.4 [P] 在 browser 中驗證整合層級 c：開啟 `/canvas/<id>`，確認 Vellum TopBar 取代 tldraw 預設頂部 panel、tldraw 預設 share panel 隱形、右側 / 底部 toolbar 完整可用、tldraw 浮水印仍然可見、無 multi-page page tabs。

## 12. 動畫紀律檢查（落實設計決策「動畫分區」）

- [x] 12.1 [P] 落實設計決策「動畫分區」：撰寫 lint-style assertion 測試 `apps/web/src/canvas/Editor.no-canvas-animation.test.tsx`，render `<Editor>` 後查詢 `<Tldraw>` 元素的祖鏈內 MUST NOT 出現 `motion.*` 元件 displayName 或 `AnimatePresence`；對 `MainMenu` 與 rename dialog 同時做 positive 斷言（祖鏈 SHOULD 有 motion 元件）。覆蓋 spec「Chrome animations use motion; canvas region uses none」。

## 13. 最終驗收

- [x] 13.1 跑完整測試套件 `bun test`：persistence、TopBar、MainMenu、CanvasPage、Editor、use-autosave、no-canvas-animation 全綠；coverage ≥ 70%。
- [x] 13.2 [P] 跑 `bun run typecheck`：`@vellum/web` 與 `@vellum/shared` 兩個 package 無 ts error。
- [x] 13.3 [P] 跑 `bunx oxlint` 與 `bunx oxfmt --check`：無新增 warning。
- [x] 13.4 [P] 用 plain DOM 巡檢確認 spec「No chrome component contains a hardcoded display string」：用 `grep -rn '"' apps/web/src/chrome/ apps/web/src/canvas/CanvasPage.tsx apps/web/src/canvas/Editor.tsx | grep -v "from '" | grep -v "import" | grep -v "//"` 人工 review 非 i18n 字面字串；亦或寫 codemod-style 測試掃 source 檔（可接受）。
- [x] 13.5 [P] 用 plain JSON diff 工具比對 zh-TW.json 與 en.json 的 `canvas.chrome.*` 與 `canvas.title.*` 子樹鍵集合 MUST 一致（覆蓋 spec「Locale catalogs cover every chrome key in both languages」）。
- [x] 13.6 在 browser 手動跑 happy path：登入 → 建立 canvas → 進入 `/canvas/<id>` → 用 tldraw 工具畫幾筆 → 重整頁面 → 內容仍在；按 MainMenu Rename → 改名 → 標題更新；按 Share → 看到 toast；確認 tldraw 浮水印仍在；確認沒有 page tabs。
