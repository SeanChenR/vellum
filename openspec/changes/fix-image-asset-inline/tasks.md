## 1. Setup & ADR

- [x] 1.1 寫 docs/adr/0011-image-asset-phase1-data-url.md，照 design.md「Phase 1 inline asset 走 data URL，phase 2 才接 cloud upload」decision 記錄 phase 1 取捨 + phase 2 cloud upload 升級點，並涵蓋「5 MB size cap + unsupported MIME 用 i18n toast」rationale 與「SVG 用 raw text + DOMPurify SVG profile，binary 用 base64」編碼策略
- [x] 1.2 [P] 在 packages/shared/src/locales/zh-TW.json 與 en.json 同步新增 `errors.image.tooLarge` 與 `errors.image.unsupportedFormat`（Asset store rejects oversize and unsupported uploads with localized errors 要求兩語同步）

## 2. Tests First — inlineImageAsset helper（TDD）

- [x] 2.1 [P] 寫 apps/web/src/canvas/asset-inline.test.ts，覆蓋 Tldraw asset store inlines image uploads as same-origin data URLs：5 種支援 MIME (image/svg+xml / png / jpeg / gif / webp) 各回 `data:` URL、SVG XSS example table（`<script>` strip / `onclick=` strip / `<foreignObject>` strip）、5 MB 邊界 + Asset store rejects oversize and unsupported uploads with localized errors：6 MB throw `errors.image.tooLarge`、application/pdf throw `errors.image.unsupportedFormat`、image/heic throw `errors.image.unsupportedFormat`、size cap 在讀檔之前 short-circuit（不能呼叫 file.arrayBuffer）

## 3. Implementation — inlineImageAsset helper（GREEN）

- [x] 3.1 實作 apps/web/src/canvas/asset-inline.ts：純 function `inlineImageAsset(file)`，先 check size cap (5 MB)，再 check MIME 白名單，SVG 走 file.text() + DOMPurify SVG profile + encodeURIComponent，binary 走 file.arrayBuffer() + base64；rejection 用 Error(errorKey)；確認 2.1 test 全綠

## 4. Wire helper into tldraw asset store（GREEN）

- [x] 4.1 修改 apps/web/src/canvas/use-sync-store.ts 的 `inlineAssetStore.upload`：呼叫新 helper 回 `{ src }`；維持 `resolve(asset)` 不動；刪掉 throw "Asset upload is not supported"

## 5. 手動瀏覽器驗收

- [x] 5.1 手動驗 5 種圖：(a) 上傳 PNG 顯示成功（reload 仍在）(b) 上傳 SVG 含 `<script>alert(1)</script>` 確認 render 後 DOM 不含 script (c) 上傳 6 MB 圖看 toast 顯示「圖片過大」(d) 上傳 PDF 看 toast 顯示「不支援的格式」(e) reload page 後 image 仍顯示
