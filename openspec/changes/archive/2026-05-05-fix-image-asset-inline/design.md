## Context

PRD 第 5 章 out-of-scope guard 把「image cloud upload」列為 phase 2，當時的 add-canvas-editor-shell 把 tldraw 的 `TLAssetStore.upload` 設成 throw，等於 phase 1 完全不能放圖。User 在 M6 acceptance 階段點圖片按鈕發現 shape 完全空白回報。

PRD 真正的意思是「不要蓋 server-side blob / S3 / CDN」，並沒有禁止「畫面上顯示圖片」。Phase 1 (local-only / single-instance) 環境下，把 image 直接 inline 進 tldraw asset record（即 snapshot 的一部分）就能解決可見性，而且不違反 PRD 的 out-of-scope guard（沒打 server endpoint，沒 store binary blob）。

利害關係人：vellum owner（單人 phase 1）+ phase 2 升級時要把 cloud upload 接回來的未來 contributor。

## Goals / Non-Goals

**Goals:**

- Tldraw 內建 image shape 在 phase 1 能顯示 SVG / PNG / JPEG / GIF / WebP。
- Pure client-side：不新增 API endpoint，不改 DB schema，不打外部 CDN。
- SVG 走 sanitization（剝 `<script>` / inline event handler / `<foreignObject>`），避免從 file picker 拉一個帶 XSS 的 SVG 進 canvas。
- 5 MB 上限 + unsupported MIME guard，配 i18n toast。
- Pure helper unit test 100% 覆蓋以上。

**Non-Goals:**

- Server-side blob / S3 / CDN（phase 2）。
- Image 壓縮 / resize / EXIF strip（phase 2 cloud upload 才做）。
- HEIC / TIFF / BMP 等冷門格式（phase 1 reject）。
- Custom shape 的 image 處理（link-card 的 og:image 是另一條路徑）。
- 對 Drizzle / sync server 任何改動（snapshot 是 jsonb，能存 data URL）。

## Decisions

### Phase 1 inline asset 走 data URL，phase 2 才接 cloud upload

vs (a) phase 1 不修，留到 phase 2 一次解決 / (b) phase 1 直接做 server upload，phase 2 補強。

選 inline data URL 的理由：
- (a) 把 user-visible 的 phase 1 缺陷拖兩個月以上，不能接受。
- (b) 違反 PRD 的 phase 1 / phase 2 切分；要建 storage / 處理 access control / 加 endpoint，在 phase 1 是 over-engineering。
- 本方案：5 行 `upload` 內 + 1 個 deep helper module，零 server 改動，足夠覆蓋 phase 1 用法（單人 / 小檔 / 本機 demo）。

trade-off：
- snapshot 變大（5 MB 圖 → 5 MB 進 jsonb）。Phase 1 single-instance + dev DB，可接受。
- WS sync 重新傳整個 base64 — 多 user 場景下會重複下載。Phase 1 multi-user 不是 hot path，acceptable。
- Phase 2 升級時 image asset 的 `props.src` 從 `data:...` 換成 `https://cdn.../...`，需要 migration（一次性 base64 → blob upload + URL replace），ADR 記下來。

ADR: docs/adr/0011-image-asset-phase1-data-url.md

### SVG 用 raw text + DOMPurify SVG profile，binary 用 base64

vs 全部用 base64 / 全部用 raw text。

選 mixed 的理由：
- SVG 是文字，base64 編碼會肥 33%；raw text + URL encode 體積小、可讀、便於 debug。
- SVG 帶執行 surface (`<script>`、event handler、`<use href>` SSRF)，必須走 sanitiser。DOMPurify 已在 M6 裝起來給 markdown 用，reuse 它的 SVG profile (`USE_PROFILES: { svg: true, svgFilters: true }`)，不再裝 lib。
- Binary 格式（PNG / JPEG / GIF / WebP）內容是壓縮 binary，沒有執行 surface，base64 直編成 data URL 即可（跟 tldraw 預期格式一致）。

### 5 MB size cap + unsupported MIME 用 i18n toast

vs silent reject / silent truncate / 無上限。

選 i18n toast 的理由：
- `TLAssetStore.upload` throw 一個 `Error`，tldraw 會自動跑 toast.error 顯示 `error.message`。
- Throw 的 message 是 i18n errorKey 字串（如 `"errors.image.tooLarge"`），由 toast 處理 layer 拿 `t(errorKey)` 翻譯。對齊 vellum 既有 server errorKey 慣例。
- 5 MB 是經驗值：足夠 phase 1 demo，超過會讓 jsonb snapshot 不舒服。Phase 2 cloud upload 後 cap 可放寬。

## Risks / Trade-offs

- **Snapshot 體積暴增** → 5 MB cap + 提示 user 大圖留到 phase 2 cloud upload。對單人 demo OK。
- **DOMPurify SVG profile 已知 bypass 史**（CVE 偶發）→ 跟 DOMPurify 版本，CI dep audit。Defense in depth：tldraw image shape `<img src="data:image/svg+xml,...">` 用 `<img>` 不是 `<svg>` inline，現代瀏覽器在 `<img>` context 不執行 SVG `<script>`。雙保險。
- **base64 編碼大檔 main thread 阻塞** → 5 MB 上限 + `await file.arrayBuffer()` + chunked btoa 一次。phase 2 升級到 worker 處理 binary。
- **data URL 在 chrome dev tools 顯示時占記憶體** → 純 dev console UX 問題，不影響 prod。

## Migration Plan

純前端 + 無 schema 變更，零 migration。

部署順序（單一 commit OK）：
1. 加 helper + test
2. 改 `inlineAssetStore.upload`
3. 加 i18n keys

回滾：純前端還原即可。**既有 canvas snapshot 不受影響** — 它們的 image asset 還沒被 populate（throw 階段沒任何 src 被寫進 store）。

Phase 2 升級時要寫一支 migration 把 `data:image/...` 換成 `https://cdn.../...`，ADR-0011 記了。

## Open Questions

無——所有決策都在 PRD 約束 + 本 design 內釘住。
