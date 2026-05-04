## 1. Setup & 依賴

- [x] 1.1 [P] 前端新增依賴：`marked`、`isomorphic-dompurify`、`shiki`、`lucide-react`、`@tailwindcss/typography`（apps/web/package.json）並驗 build pass
- [x] 1.2 [P] All shape UI strings use shapes.* i18n namespace — 把 `shapes.markdown.*`、`shapes.code.*`、`shapes.callout.*`、`shapes.linkCard.*`、`shapes.common.*`（含 `lockedBy`、`copied`、`previewUnavailable`、`retry` 等共用詞）的 key 補進 zh-TW.json + en.json，兩語同步
- [x] 1.3 [P] 寫三份 ADR：docs/adr/0008-markdown-engine-marked.md、docs/adr/0009-shape-edit-lock-vs-crdt.md、docs/adr/0010-link-card-cache-two-tier.md，照 design.md 對應段落整理 rationale 與 alternatives

## 2. Tests First — Markdown 解析（TDD）

- [x] 2.1 [P] 寫 apps/web/src/canvas/shapes/markdown-parser.test.ts，覆蓋 Markdown shape parses and sanitizes content via a deep module 的 6 個 example case：`# Title` → `<h1>`、task-list checkbox、`<script>` 被 strip、`onclick=` 被 strip、GFM table、empty input 不 throw
- [x] 2.2 [P] 寫 apps/web/src/canvas/shapes/markdown-shape.test.tsx，覆蓋 Markdown shape opens a dialog editor on double-click 的 scenarios：雙擊開 dialog、Save 寫 props 並重渲、Esc discard 不變更 props、lock 中雙擊不觸發

## 3. Implementation — Markdown shape（GREEN）

- [x] 3.1 實作 markdown-parser.ts，照 Markdown engine: marked + DOMPurify decision 串 pipe（marked + GFM extensions → DOMPurify），對應 ADR 0008；確認 2.1 test 通過
- [x] 3.2 實作 markdown-shape.tsx 與 dialog editor 元件，套 `prose prose-sm` 樣式 scope；確認 2.2 test 通過

## 4. Tests First — Code highlight + shape（TDD）

- [x] 4.1 [P] 寫 apps/web/src/canvas/shapes/code-highlight.test.ts，覆蓋 Code shape highlights via lazy-loaded Shiki 的 scenarios：Python source 出現 `print` token + 字串 token、unknown lang `klingon` 回 plain text + `errors.shape.code.unknownLanguage`、12 語言名單完整
- [x] 4.2 [P] 寫 apps/web/src/canvas/shapes/code-shape.test.tsx，覆蓋 Code shape supports inline editing via textarea overlay with viewport-mode resize 的 scenarios：Tab → 2 spaces 不 shift focus、長 line 不 wrap、Copy 按鈕 → clipboard.writeText + 顯示 `shapes.code.copied`、語言切換 → re-highlight

## 5. Implementation — Code shape（GREEN）

- [x] 5.1 實作 code-highlight.ts，照 Code highlight: Shiki lazy-load + 12 語言精選 decision，每語言 grammar lazy-load，固定 light theme（M6 不做 dark mode）
- [x] 5.2 實作 code-shape.tsx：textarea overlay + viewport 模式（橫向 scroll）、最小 240×120、Copy 按鈕 + 語言選擇器；確認 4.2 test 通過

## 6. Tests First — Callout shape（TDD）

- [x] 6.1 [P] 寫 apps/web/src/canvas/shapes/callout-shape.test.tsx，覆蓋 Callout shape renders one of three variants with a lucide icon 的 scenarios：3 variants 各自 icon + 配色 + i18n key 對應、body inline markdown 渲染（`**bold**` → `<strong>`）、block markdown（`# heading`）被 escape 為 literal text

## 7. Implementation — Callout shape（GREEN）

- [x] 7.1 實作 callout-shape.tsx：3 variants 配色 + lucide icon (Info / AlertTriangle / AlertOctagon) + body 通過 inline-only markdown subset；確認 6.1 test 通過

## 8. Tests First — Link card 全套（TDD）

- [x] 8.1 [P] 寫 apps/api/src/og/parse-html.test.ts，覆蓋 OG metadata endpoint returns sanitized parsed result with two-tier cache 中 parser 部分的 example table：og:title、og:description、`<title>` fallback、`<link rel="icon">`、none-of-them → empty object
- [x] 8.2 [P] 寫 apps/api/src/og/index.test.ts，覆蓋 endpoint 整合：success 回 envelope、private IP 被 validateExternalUrl 拒絕回 invalidUrl、第 31 個 request 60 秒內回 429 + Retry-After、cache 30 分內 hit 不重打外部
- [x] 8.3 [P] 寫 apps/web/src/canvas/shapes/link-card-state.test.ts，覆蓋 Link card shape transitions through pending / success / error states 全部 transition：pending→success、pending→error on 502、error→pending on retry、success→pending on URL change、stale 24h+ auto pending
- [x] 8.4 [P] 寫 apps/web/src/canvas/shapes/link-card-shape.test.tsx：success 渲卡片、error 渲 `previewUnavailable` placeholder + favicon + retry button、URL 編輯後自動 re-fetch

## 9. Implementation — Link card server（GREEN）

- [x] 9.1 實作 apps/api/src/og/parse-html.ts pure HTML parser
- [x] 9.2 實作 apps/api/src/og/index.ts handler，照 Link card cache: snapshot + server LRU 兩層 decision 的 server 半邊：先 validateExternalUrl → fetch (5s timeout / 5MB cap) → parseHtmlForOg → 入 LRU 30 min；ADR 0010
- [x] 9.3 在 apps/api/src/lib/rate-limit-rules.ts 新增 OG endpoint 規則：每 user 30 req/min；429 帶 Retry-After
- [x] 9.4 把 og handler 掛載到 apps/api/src/index.ts 路由表（要求認證 session，無 session 回 401）

## 10. Implementation — Link card client（GREEN）

- [x] 10.1 實作 apps/web/src/canvas/shapes/link-card-state.ts state machine（pending / success / error transitions）
- [x] 10.2 實作 apps/web/src/canvas/shapes/link-card-shape.tsx：成功卡片版面、error placeholder + favicon + retry、URL 變更 re-fetch；shape props 留 `metadata` + `fetchedAt`（Link card cache: snapshot + server LRU 兩層 client 半邊：snapshot 存最後結果讓重整不閃白）

## 11. Tests First — Shape edit lock（TDD）

- [x] 11.1 [P] 寫 apps/web/src/canvas/shapes/use-shape-edit-lock.test.ts，覆蓋 Custom shapes enforce a first-editor-wins edit lock during multiplayer sessions：第二人 `editingShapeId` 對到該 shape → `canEdit: false` + lockedBy 帶 user name、自己 editing 不受影響、disconnect 後清除、`lastActiveAt` > 5 分鐘 stale fallback

## 12. Implementation — Shape edit lock（GREEN）

- [x] 12.1 實作 use-shape-edit-lock.ts，照 Shape edit lock: 借用 tldraw `editingShapeId`（first-editor-wins） decision；ADR 0009
- [x] 12.2 把 `useShapeEditLock` 接到 4 個 shape 的編輯入口：markdown 雙擊、code textarea focus、callout 雙擊、link-card URL edit；lock 中顯示 `shapes.common.lockedBy` badge + 禁編輯動作

## 13. Tests First — Toolbar + paste-detect（TDD）

- [x] 13.1 [P] 寫 apps/web/src/canvas/ShapeToolbar.test.tsx，覆蓋 Canvas toolbar exposes four custom shape insertion buttons：4 按鈕固定順序 (Markdown / Code / Callout / Link card)、tooltip 隨 active locale、點擊 → 對應 shape insert + 預設 content + 成為 selection
- [x] 13.2 [P] 寫 paste-detect unit test，覆蓋 Pasting a URL onto an empty canvas region creates a Link card shape：single URL → link-card pending、`https://a.com\nhttps://b.com` → text shape、Markdown 編輯 dialog 內 paste → 文字進 textarea 不建 link-card

## 14. Implementation — Editor 整合（GREEN）

- [x] 14.1 實作 apps/web/src/canvas/ShapeToolbar.tsx，照 Shape entry point: toolbar 4 buttons + paste-detect Link card 的 toolbar 半邊；用 lucide icon + tldraw overrides API 整合（不改 tldraw 源碼）
- [x] 14.2 實作 paste-detect 邏輯（Shape entry point: toolbar 4 buttons + paste-detect Link card 的 paste 半邊），掛在 apps/web/src/canvas/Editor.tsx 的 paste handler；single-URL 偵測用 `URL` constructor + 純 http(s) check
- [x] 14.3 在 Editor.tsx 註冊四個 customShapes（Canvas exposes four custom shape types — Markdown, Code, Callout, Link card），確認 snapshot persistence round-trip 不損內容

## 15. Visual / Preview iteration（非 TDD，per TDD scope 邊界）

- [x] 15.1 [P] preview-iteration：Markdown shape typography（prose 配色、表格樣式、code-fence 背景）
- [x] 15.2 [P] preview-iteration：Code shape 視覺（字距、行高、Copy 按鈕 hover、語言選擇器 dropdown 樣式）
- [x] 15.3 [P] preview-iteration：Callout shape 三 variants 視覺（accent 配色、icon 大小、padding 比例）
- [x] 15.4 [P] preview-iteration：Link card success / error 兩種狀態版面（圖片 onError fallback、retry 按鈕互動感）
- [x] 15.5 [P] preview-iteration：ShapeToolbar 4 按鈕排版、icon size、tooltip 出現位置

## 16. 手動瀏覽器驗收

- [x] 16.1 兩 browser 開同一 canvas：(a) 4 個 shape 各自建立 / 編輯 / persist 通過 reload (b) lock badge 正確顯示與消失 (c) 貼 URL 自動轉 Link card 行為 (d) OG 失敗 placeholder + 重試 (e) zh-TW / en 切換 shape UI 字串
