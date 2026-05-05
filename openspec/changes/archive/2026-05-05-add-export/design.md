## Context

M7 是 phase 1 milestone roadmap（`project_milestones.md`）中最後一個 feature milestone（M8 之後是 branding / animation / a11y / coverage 補位）。Export 在 PRD 的 Implementation Decisions 內列為「Export Module（5 格式）」，但 discuss 階段確認 Markdown 對 Whimsical-clone 定位下的價值極低，砍至 4 格式。

當前狀態：
- `apps/web/src/chrome/MainMenu.tsx:97-103` 內 `EXPORT_ITEMS` 為五個 disabled placeholder（PNG / SVG / PDF / JSON / Markdown），全部帶 "coming soon" 後綴。
- `Editor.tsx` 已透過 `VellumChromeContext.mainMenu` 注入 `onRename / onDuplicate / onDelete` callback；export 尚未連線。
- canvas-editor spec L252-280 規範了「5 個 disabled item」這個 placeholder 行為。
- tldraw 4.5.10 自帶 `editor.exportAs(shapes, 'png' | 'svg' | 'json', opts)` 與 `editor.getSvgString()`，client 已有完整 store。
- 沒有 PDF 相關 dependency。

約束：
- Hard rule #1（TDD）：export 核心函式 + slugify 屬於「邏輯」走 TDD，submenu 視覺迭代不寫像素測試。
- Hard rule #2（i18n）：所有新增字串 zh-TW / en 同 PR 補齊。
- Hard rule #5（動畫）：canvas 內不加動畫——export 進度提示用 toast（已存在的 chrome toast pattern），不在 canvas 上 overlay spinner。
- Hard rule #6（Bun-native）：能用 Bun / Web API 的優先，jsPDF 是不可避免的 npm dep。
- Hard rule #8（out-of-scope）：不開 ExportDialog、不做 server-side、不做 Markdown。

## Goals / Non-Goals

**Goals:**

- 4 格式（PNG / SVG / PDF / JSON）皆可從 MainMenu 一鍵觸發，editor / owner 可用、viewer 看不到。
- PNG / PDF 內建 1× / 2× / 4× 解析度子選項；SVG / JSON 為單一觸發。
- 整張 / 選取自動切換：有選取就匯出選取，沒選取匯出整張（沿用 tldraw 預設 `exportAs` 語意）。
- 檔名一致：`{slugify(canvas.title)}.{ext}`，title 為空 fallback `canvas`。
- 失敗時顯示 toast（用 i18n key），不靜默吞錯。
- 70% coverage 涵蓋：core export 函式、slugify、role gate 條件分支、檔名產生。

**Non-Goals:**

- 不做向量 PDF（jsPDF + raster PNG embed 即可）。
- 不做 ExportDialog（dropdown 直接觸發即夠）。
- 不做 server-side 匯出。
- 不做 Markdown 格式。
- 不做 export history、不做下載追蹤遙測。
- 不為 viewer 做防截圖 / DRM——role gate 是 affordance 不是強制。
- 不在 canvas 上加 overlay 動畫（toast 即可）。

## Decisions

### Adopt jsPDF as the only PDF dependency, embed PNG (not vector)

採用 `jspdf`（MIT、~50KB gzipped、零依賴）作為 PDF 產生器，內部流程：tldraw `exportAs('png', { scale })` → `Blob` → `FileReader` → dataURL → `jsPDF.addImage()` → `jsPDF.save(filename)`。

**Rationale**：
- PRD 沒要求向量 PDF；user 也明示「沒必要把 SVG 包進去」。
- raster 路徑體積可控（PNG 高解析度本身已夠看）；向量路徑（`pdf-lib` + tldraw SVG → 嵌入）需要處理 SVG 內 embedded font / image asset 的轉換邊界，工序大。
- jsPDF 是純 client，配合 hard rule #6「不引入 server hot-path 依賴」。

**Alternatives considered**：
- `pdf-lib` + SVG：保留向量但工序倍增；reject。
- `html2canvas` → jsPDF：tldraw 已自帶 `exportAs('png')`，html2canvas 是繞遠路；reject。
- Server-side headless chrome render：違反 single-binary 主軸；reject。

### New deep module: `export-canvas` 純函式封裝匯出管線

新增 `apps/web/src/canvas/export/export-canvas.ts`，匯出單一 entry function：

```typescript
export type ExportFormat = "png" | "svg" | "pdf" | "json";
export type ExportScale = 1 | 2 | 4;

export interface ExportOptions {
  editor: TldrawEditor;
  format: ExportFormat;
  scale?: ExportScale;     // 僅 PNG / PDF 使用，預設 2
  filename: string;        // 已 slugify
}

export async function exportCanvas(opts: ExportOptions): Promise<void>;
```

內部依 format 分派：PNG / SVG / JSON 直接 wrap `editor.exportAs(...)`、PDF 走 PNG → jsPDF。失敗時 throw `ExportError`，由 caller 接住轉 toast。

**Rationale**：
- Deep module（pure logic in / Blob out / save side-effect 集中）方便 TDD：傳 fake editor 即可 assert 觸發了哪個 tldraw API + 用了哪個 scale。
- chrome 端只負責收集 user intent（哪個 format / 哪個 scale）→ 呼叫 `exportCanvas`，不持有匯出邏輯。

**Alternatives considered**：
- 在 `MainMenu.tsx` 內直接寫 export logic：違反 hard rule「200-400 行 / file」與深模組原則；reject。
- 每個 format 一個獨立函式（`exportPng / exportSvg / ...`）：對外 API 散；reject。

### `slugify` 為自有 micro-utility（不引 dependency）

新增 `apps/web/src/canvas/export/slugify.ts`：保留 ASCII 與基本 CJK，把空白與符號換成 `-`，前後 trim，全空 fallback `"canvas"`。

```typescript
slugify("我的 Canvas (草稿)") // → "我的-canvas-草稿"
slugify("")                    // → "canvas"
slugify("////")                // → "canvas"
```

**Rationale**：
- 不引 `slugify` / `slugify-ts` 等 npm，30 行純函式即可（hard rule：file < 800 lines 但更要 prefer 不依賴）。
- 保留 CJK：user 是繁中使用者，title 多為「我的 canvas」；filename 內保留中文比強制 transliterate 對 OS 友善（macOS / Windows 都接受 UTF-8 檔名）。

**Alternatives considered**：
- 引 npm `slugify`：30 行能解決的事不要拉依賴；reject。
- ASCII-only（CJK transliterate）：失去語義，user 找檔案困難；reject。

### Role gate 在 MainMenu 渲染層做（隱藏 vs disable）

`MainMenu` 的 export submenu 接 `isReadOnly: boolean` prop（從 `Editor.tsx` 經 `VellumChromeContext.mainMenu` 傳入）。`isReadOnly === true` 時整個 export submenu **不渲染**（連入口都看不到）；editor / owner 看到 4 個可點 item。

**Rationale**：
- 「viewer 不能下載」是 affordance；UI 層面就不該出現按鈕。
- 比 disable 乾淨：disable 會讓 viewer 看到「有功能但不能用」的挫折感（沒商業價值）。
- 客戶端強制檔下載擋不住 DevTools，這個決定的目的是 UX 不是 DRM（已寫進 Non-Goals）。

**Alternatives considered**：
- Disabled 帶 tooltip「升級為編輯者以匯出」：邀請流不在 export 範圍內、額外 i18n 與設計負擔；reject。
- 只擋 PDF / PNG（讓 viewer 拿 JSON 備份）：為 viewer 客製化複雜度沒必要；reject。

### 解析度子選項：menu 內展開（不開 dialog）

每個有解析度的 format（PNG / PDF）展開二級 submenu：`PNG ▶ 1× / 2× / 4×` 與 `PDF ▶ 1× / 2× / 4×`。SVG / JSON 直接觸發。預設 scale = 2（兼顧畫質與檔案大小）。

**Rationale**：
- 沿用 tldraw 自身的 menu 模式（已有 hover-展開 submenu 的 css / state）。
- dialog 對「半秒就完成」的觸發過重；user 已明確「用 tldraw 的就好」。
- 預設 2× 與 tldraw 內建 default 一致，最少驚奇。

**Alternatives considered**：
- 一律觸發後彈 small popover 問解析度：多一步操作；reject。
- 全部固定 2×：失去 PRD US 44 要求的彈性；reject。

### 檔名 `{slug}.{ext}` 走 anchor download，不用 File System Access API

`exportCanvas` 內部建立 `<a download={filename} href={URL.createObjectURL(blob)}>`，programmatic click 觸發下載，下載完 `URL.revokeObjectURL`。

**Rationale**：
- File System Access API 在 Safari / Firefox 仍未 GA（2026 仍如此）；anchor download 全瀏覽器通用。
- `download` 屬性帶到 anchor 上 OS 會自動處理重名（加 `-1` / `(1)`）；不用自己重複名衝突。

**Alternatives considered**：
- `showSaveFilePicker()`：Chromium-only；reject。
- 引 `file-saver` npm：同樣是 anchor + revoke 的 wrapper，多一個依賴；reject。

### 失敗訊息走 toast，i18n 兩語言同步

匯出失敗（jsPDF 拋錯、tldraw `exportAs` reject、Blob 為空）統一在 chrome 層 toast，key 為 `canvas.chrome.mainMenu.exportFailed`；成功為 `canvas.chrome.mainMenu.exportSuccess`（帶 format 名）。

**Rationale**：
- Hard rule #2（i18n discipline）：error 走 errorKey、UI 走 t(key)。
- 不在 canvas 上 overlay loader（hard rule #5），也不開 modal。

**Alternatives considered**：
- 不顯示成功 toast：completeness preference 下，user 期待有回饋；reject。
- alert()：阻塞、無 a11y、不 i18n；reject。

## Risks / Trade-offs

- **[Risk] 大型 canvas 在 PDF 4× 解析度可能 OOM 或耗時 >10s** → Mitigation：tldraw `exportAs('png', { scale })` 內部已用 OffscreenCanvas（瀏覽器支援時）；jsPDF 接 dataURL 為 stream-friendly。實作時加 try / catch + toast，不額外加 cancel UI（phase 1 簡化）。70% coverage 內針對「scale=4 + 多 shapes」加單測（assert 不 throw、產出 Blob.size > 0）。
- **[Risk] Markdown shape 內 raw HTML / iframe / `<script>` 走 PNG raster 後是否如實呈現** → Mitigation：tldraw 已 sanitize 過 shape render；raster 過程繼承 sanitized 結果，無新增 XSS 面。
- **[Risk] viewer 透過 DevTools 仍可下載** → 已在 Non-Goals 明示這是 affordance；不為 phase 1 處理。
- **[Risk] 中文 / Emoji 檔名在 Windows 某些檔總管會顯示亂碼** → 已驗證 UTF-8 BOM 化的檔名於 macOS / Win 11 / Ubuntu 22 均正確；slug 失敗 fallback `canvas` 已涵蓋極端 case。
- **[Trade-off] 不做向量 PDF** → 列印可能在大尺寸下出現 raster artefact。phase 2 可獨立加 `pdf-lib` 路徑而不破壞既有 API（`exportCanvas` 增加 `vector?: boolean` opt）。
- **[Trade-off] role gate 用 boolean 不用 enum** → 跟既有 `isReadOnly` 一致；如未來引入更細的 role（comment-only），需擴成 enum，但目前只有 viewer / editor / owner 兩 bucket。
