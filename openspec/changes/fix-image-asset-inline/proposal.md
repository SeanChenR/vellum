## Problem

tldraw 的內建 image shape（toolbar 上的圖片按鈕）目前**完全無法顯示任何圖片**。user 拖檔 / 點按鈕選檔後，shape 顯示空白方框；不論 SVG / PNG / JPEG / GIF / WebP 全部失效。Phase 1 對使用者來說「我有 image 工具但放不出圖」非常糟糕。

## Root Cause

apps/web/src/canvas/use-sync-store.ts 內的 `inlineAssetStore.upload()` 一律 throw：

```ts
const inlineAssetStore: TLAssetStore = {
  async upload() {
    throw new Error("Asset upload is not supported in phase 1 (see docs/PRD.md).");
  },
  ...
};
```

當初是為了強制走 PRD「image cloud upload 是 phase 2」這條規則，但 throw 等於直接讓 image shape 殘廢。tldraw 預期 `upload(asset, file)` 回傳 `{ src }`；throw 之後 asset 沒有 src，shape 拿不到圖。

PRD 第 5 章 out-of-scope guard 列「image cloud upload」是 phase 2 的真正用意是「不蓋 server-side blob storage / S3 / CDN 那條路」，並沒有說「phase 1 不能放圖」。phase 1 完全不能放圖跟 PRD 的精神不一致。

## Proposed Solution

`inlineAssetStore.upload` 改成把檔案 inline 成 data URL，pure client-side、零 server endpoint，符合「不做 cloud upload」這條 phase 1 規則。

具體：

- 對 `image/svg+xml`：用 `file.text()` 讀 raw SVG，做 SVG-specific sanitisation（DOMPurify 的 SVG profile：strip `<script>` / 事件 handler / `<foreignObject>` 等危險節點），然後 `data:image/svg+xml;utf8,${encodeURIComponent(safe)}`（比 base64 體積小、可讀）。
- 對其他 raster image MIME（`image/png`、`image/jpeg`、`image/gif`、`image/webp`）：`file.arrayBuffer()` → base64 → `data:${mime};base64,${b64}`。
- 對非 image MIME 或 file size 超過 5 MB：throw 一個帶 i18n errorKey 的 Error，由 tldraw 的 toast surface 顯示給 user，不寫 garbage data URL 進 snapshot。
- `resolve(asset)` 維持不變（已 read `props.src` 直接回傳）。
- 補一份 deep-module helper `apps/web/src/canvas/asset-inline.ts` 包成 pure function `inlineImageAsset(file: File): Promise<{ src: string }>`，可單獨 unit test SVG sanitisation + base64 encoding + size cap，不需要 tldraw editor 跑起來。

Phase 2 升級到 cloud upload 時這個 helper 自然被替換為 `uploadToS3(file)` 等。

## Non-Goals (optional)

- **Server-side image proxy / blob storage / S3 / CDN**：仍是 phase 2 範圍。本 change 純 client-side data URL，不新增任何 API endpoint。
- **DB / snapshot schema 變更**：不需要 — image 走的是 tldraw asset record，已有結構，data URL 塞進 `props.src`。
- **Image 壓縮 / resize**：不做。user 自己控制丟多大的圖，5 MB 上限即時擋掉。
- **拖放多張 image / 批次 upload**：保留 tldraw 預設行為（單檔 / 多檔都會 multiple upload calls），不額外處理。
- **HEIC / TIFF / BMP**：phase 1 不支援；遇到 throw 帶 errorKey。
- **Shape link card 的 og:image 顯示**：那是 add-custom-shapes 的範圍，跟 image asset 不同 code path，不在本 change scope。

## Success Criteria

1. user 從 image toolbar 按鈕（或拖檔到 canvas）選一個 SVG / PNG / JPEG / GIF / WebP 檔，**畫面立即顯示該圖片**，shape 是 tldraw 預設 image shape（不是我們 4 個 custom shape）。
2. 重新整理頁面後 image **仍然顯示**（snapshot 帶著 data URL 同步回來）。
3. user 上傳 6 MB 的 PNG → toast 出現「圖片過大」訊息，shape **不被建立**，snapshot 不被污染。
4. user 上傳 PDF / docx / 其他非 image MIME → toast 出現「不支援的格式」訊息。
5. SVG 檔內含 `<script>alert(1)</script>` → 上傳後 render 出來的 SVG **不含 `<script>`**（DOMPurify 已 strip）。
6. `inlineImageAsset(file)` pure function unit test 通過：5 種 image MIME、SVG XSS strip、size cap、unsupported MIME。
7. 既有的 4 個 custom shape (markdown / code / callout / link-card) 行為**不變**，typecheck + 既有 unit test 全綠。

## Impact

- 受影響程式碼:
  - 修改:
    - apps/web/src/canvas/use-sync-store.ts（`inlineAssetStore.upload` 從 throw 改 inline data URL；引用新 helper）
    - packages/shared/src/locales/zh-TW.json（新增 `errors.image.tooLarge` / `errors.image.unsupportedFormat`）
    - packages/shared/src/locales/en.json（同上 i18n keys）
  - 新增:
    - apps/web/src/canvas/asset-inline.ts（pure helper `inlineImageAsset`）
    - apps/web/src/canvas/asset-inline.test.ts（5 種 MIME / SVG XSS / size cap / unsupported MIME 的 unit test）
    - docs/adr/0011-image-asset-phase1-data-url.md（記錄 phase 1 走 data URL inline 的取捨 + phase 2 升級點）
