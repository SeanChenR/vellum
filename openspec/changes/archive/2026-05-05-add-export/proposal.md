## Why

PRD US 38–44（Export module）規定：canvas owner / editor 必須能匯出 PNG / SVG / PDF / JSON 四種格式（Markdown 已於 discuss 階段砍除），整張或選取範圍，PNG / PDF 支援 1× / 2× / 4× 解析度。目前 MainMenu 內 export submenu 是五個 disabled「coming soon」placeholder（見 `apps/web/src/chrome/MainMenu.tsx:97-103`），用戶即使是 owner 也無法把 canvas 帶走——這是 M7 milestone 唯一還未交付的能力，blocking phase 1 收斂。

## What Changes

- 新增 `canvas-export` capability：純 client-side 的匯出管線，呼叫 tldraw 自帶 `editor.exportAs()`（PNG / SVG / JSON）+ jsPDF（PDF）。
- Submenu 從 5 個 disabled item 改為 4 個 functional item（PNG / SVG / PDF / JSON），Markdown 從清單與 i18n key 中移除。
- Viewer（`isReadOnly === true`）打開 MainMenu 時 export submenu 整個隱藏；editor / owner 看得到、可觸發。
- PNG / PDF 觸發後 inline 提供 1× / 2× / 4× 解析度選項；SVG / JSON 為單一觸發（無解析度概念）。
- 範圍：若 canvas 有選取項目，預設匯出選取；無選取則匯出整張（沿用 tldraw `exportAs` 既有語意）。
- 檔名：`{slugify(canvas.title)}.{ext}`，title 為空時 fallback 至 `canvas`。
- 新增 dev dependency：`jspdf`。
- i18n：兩語言（zh-TW / en）同步補上 `canvas.chrome.mainMenu.export*` 全套 key（含 toast 成功 / 失敗訊息），移除 `exportMarkdown` 與 `exportComingSoon`。
- **BREAKING**（spec 層）：`canvas-editor` capability 內「MainMenu exposes ... a placeholder Export submenu」的 requirement 從「5 個 disabled item」改為「4 個 functional item」。

## Non-Goals

- **不做向量 PDF**：jsPDF 內 embed 高解析度 PNG 即可，不採用 `pdf-lib` + SVG 路徑（PRD 沒要求向量、體積與工序成本不划算）。
- **不做 ExportDialog**：沿用 dropdown menu 直接觸發，不開獨立的設定 / 預覽 dialog。
- **不做 server-side 匯出**：所有 raster / serialize 都在 browser 端完成；不為 PDF 引入 server canvas / headless chrome。
- **不做 Markdown export**：discuss 階段確認此格式對 Whimsical-clone 定位下的價值極低，從 PRD US 42 的範圍中拿掉。
- **不做匯出 history / 重複下載追蹤**：不寫資料庫，不發遙測；單純觸發 `Bun.write` 等價的 client download。
- **不擋 viewer 的瀏覽器 DevTools 截圖 / 複製貼上**：role gate 是 UI affordance，不是 DRM；server-side data 已經 streamed 過去，client 強制檔擋不住。

## Capabilities

### New Capabilities

- `canvas-export`: 純 client-side 把當前 canvas（整張或選取）以 PNG / SVG / PDF / JSON 四種格式下載到本機，含解析度選項（PNG / PDF）與 viewer role gate。

### Modified Capabilities

- `canvas-editor`: MainMenu 的 Export submenu 從「5 個 disabled placeholder」改為「4 個 functional item（依 role 顯示 / 隱藏）」；Markdown 從可選清單中移除。

## Impact

- Affected specs: `canvas-export`（新）、`canvas-editor`（修改）
- Affected code:
  - New:
    - apps/web/src/canvas/export/export-canvas.ts
    - apps/web/src/canvas/export/export-canvas.test.ts
    - apps/web/src/canvas/export/slugify.ts
    - apps/web/src/canvas/export/slugify.test.ts
  - Modified:
    - apps/web/src/chrome/MainMenu.tsx
    - apps/web/src/chrome/MainMenu.test.tsx
    - apps/web/src/canvas/Editor.tsx
    - apps/web/src/canvas/CanvasPage.tsx
    - apps/web/package.json
    - bun.lock
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
  - Removed: (none)
- Dependencies: 新增 `jspdf`（client-side PDF 產生器，零依賴、MIT、~50KB gzipped）
- 不動 server / DB / WS schema
