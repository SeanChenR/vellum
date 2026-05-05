## 1. Setup 與依賴

- [x] 1.1 在 apps/web/package.json 加上 jsPDF 依賴並執行 bun install — 對應「Adopt jsPDF as the only PDF dependency, embed PNG (not vector)」
- [x] 1.2 確認 jsPDF 在 vite / Bun bundler 下可正常 tree-shake import（產生 dist 大小 sanity check）

## 2. slugify utility（TDD：red → green）

- [x] 2.1 [P] 寫 apps/web/src/canvas/export/slugify.test.ts，覆蓋 ASCII / CJK / 符號 / 空字串 / 全符號 fallback、實作對應「Export filename derives from canvas title via slugify」與「`slugify` 為自有 micro-utility（不引 dependency）」
- [x] 2.2 [P] 在 apps/web/src/canvas/export/slugify.ts 實作 slugify 純函式至 2.1 全綠（保留 ASCII + CJK、其它字元換成 `-`、collapse 連續 `-`、trim、空 fallback `canvas`）

## 3. export-canvas core module（TDD：red → green）

- [x] 3.1 寫 apps/web/src/canvas/export/export-canvas.test.ts：建構 fake tldraw editor double，驗證 PNG / SVG / PDF / JSON 各自呼叫到的 tldraw API + scale + 檔名，對應「Editor and owner can export the canvas in four formats」
- [x] 3.2 在同一份測試中加入「Export range follows current selection」cases：editor.getSelectedShapes() 有值時傳 selectedShapes，無值時傳 entire canvas
- [x] 3.3 在同一份測試中加入「Export pipeline runs entirely in the browser」case：mock global fetch，匯出全程斷言 fetch 呼叫次數 = 0
- [x] 3.4 在 apps/web/src/canvas/export/export-canvas.ts 實作 `exportCanvas(opts)` 純函式至 3.1–3.3 全綠，對應「New deep module: `export-canvas` 純函式封裝匯出管線」
- [x] 3.5 在 export-canvas.ts 內加入 jsPDF embed PNG dataURL → `addImage` → `save(filename)` 路徑，並加成功 / 失敗 Blob 大小 = 0 的測試
- [x] 3.6 在 export-canvas.ts 內實作 `triggerDownload(blob, filename)` 走 `<a download>` + `URL.createObjectURL` + revoke，對應「檔名 `{slug}.{ext}` 走 anchor download，不用 File System Access API」

## 4. i18n 兩語同步補 key

- [x] 4.1 [P] 在 packages/shared/src/locales/zh-TW.json 加上 `canvas.chrome.mainMenu.exportPng / exportSvg / exportPdf / exportJson / exportScale1x / exportScale2x / exportScale4x / exportSuccess / exportFailed`，移除 `exportMarkdown` 與 `exportComingSoon`
- [x] 4.2 [P] 在 packages/shared/src/locales/en.json 鏡射 4.1 的所有 key（同 namespace、同移除規則），對應「失敗訊息走 toast，i18n 兩語言同步」

## 5. MainMenu 行為從 placeholder 改為 functional

- [x] 5.1 更新 apps/web/src/chrome/MainMenu.test.tsx：紅燈測試 isReadOnly=true 時 export submenu 不渲染、isReadOnly=false 時 4 個 functional items 出現，對應「Viewer cannot access export controls」與「Role gate 在 MainMenu 渲染層做（隱藏 vs disable）」
- [x] 5.2 同一份測試新增 PNG / PDF 二級 submenu 渲染 1× / 2× / 4× 三個 scale items 的 case，對應「解析度子選項：menu 內展開（不開 dialog）」
- [x] 5.3 同一份測試新增 export item click 後觸發傳入 callback 並帶 `(format, scale)` 引數的 case
- [x] 5.4 修改 apps/web/src/chrome/MainMenu.tsx：MainMenuProps 加 `isReadOnly: boolean` 與 `onExport(format, scale): void`，移除 placeholder EXPORT_ITEMS 中的 `exportMarkdown`，把剩下 4 項從 disabled 改為呼叫 onExport，並依 isReadOnly 決定整段渲染與否——直到 5.1–5.3 全綠
- [x] 5.5 修改 5.4 的 MainMenu 渲染 PNG / PDF 二級 submenu 與 scale item 行為，並維持原 outside-click / Escape 關閉 logic

## 6. Editor 與 CanvasPage 接線

- [x] 6.1 更新 apps/web/src/canvas/Editor.test.tsx：assert `mainMenu.onExport` callback 在被 invoke 時呼叫 exportCanvas 並傳入 `slugify(canvas.title)` 為 filename
- [x] 6.2 修改 apps/web/src/canvas/Editor.tsx：在 `chromeContext.mainMenu` 加入 `onExport` 與 `isReadOnly`，內部 wrap 呼叫 `exportCanvas({ editor, format, scale, filename })`，並把 promise resolve / reject 接到 toast 系統
- [x] 6.3 修改 apps/web/src/canvas/CanvasPage.tsx：把 `title` 確實透傳到 `<Editor>`（若已透傳則 verify only），確保 Editor 拿到的 title 就是 slugify 的輸入

## 7. Toast 整合（成功 / 失敗）

- [x] 7.1 在 Editor.tsx 內把 export resolve 對應 `canvas.chrome.mainMenu.exportSuccess`（帶 format 名為 i18n 參數）、reject 對應 `canvas.chrome.mainMenu.exportFailed`，沿用既有 chrome toast pattern，對應「Export results trigger localized toasts」
- [x] 7.2 補一個整合測試：fake exportCanvas reject 時 Editor 觸發 failed toast 而 editor 不 crash

## 8. 驗證收斂

- [x] 8.1 `bun test --coverage` 全綠且 export 相關新檔案覆蓋率 ≥ 70%
- [x] 8.2 `bunx oxlint` 與 `bunx oxfmt --check` 全綠
- [x] 8.3 `bun run typecheck` 全綠
- [x] 8.4 手動 smoke test：dev server 開 canvas，editor 身分依序匯出 PNG 2× / SVG / PDF 4× / JSON，驗證檔案落地、檔名為 `{slug(title)}.{ext}`；切 viewer 身分驗證 export submenu 不出現——對應「MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu」spec（archive 後將升級為 functional）的人工 sign-off
