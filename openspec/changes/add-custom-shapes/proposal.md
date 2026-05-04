## Why

M6 milestone：完成 4 個 first-class custom shape（Markdown / Code / Callout / Link card），讓 vellum 從「白板」升級為「能放結構化內容的協作畫布」。canvas-editor 殼（M3）+ multiplayer sync（M4）+ sharing（M5.5）已就緒，但目前 user 只能畫圖、不能放真正的內容；M6 是把 vellum 變成可長期使用的工具的關鍵段（PRD 第 5 章 custom shapes）。

## What Changes

- **toolbar 入口**：tldraw toolbar 加 4 個 lucide icon 按鈕對應 4 個 shape；Link card 額外支援「畫布上貼 URL 自動轉換」
- **Markdown shape**：`marked` + `DOMPurify` 解析 GFM (table / task-list / strike / autolink)；shape 永遠顯示 render 後 HTML（`@tailwindcss/typography` prose）；雙擊開 dialog 大編輯框，blur / save 寫回 props
- **Code shape**：Shiki lazy-load + 12 語言精選（JS/TS/Python/Go/Swift/Rust/HTML/CSS/SQL/Bash/Markdown/JSON）；純 textarea + 高亮 overlay；resize → 容器 viewport 模式（內容超出橫向 scroll、no auto-wrap）；附 Copy 按鈕 + 語言選擇器；最小尺寸 240×120
- **Callout shape (Tier 1)**：3 variants (info / warning / danger)，lucide icon + variant 各自配色；body 單段，支援 inline markdown subset
- **Link card shape**：自動 scrape on paste / on URL 變更 / 24 小時 stale auto / user 按重整鍵；新增 `POST /api/og` (rate limit 30/min/user) 回傳 `{ title, description, image, favicon, siteName, fetchedAt }`；SSRF 用既有 `validateExternalUrl()`；Cache 兩層：snapshot 存最後結果 + server LRU 30 分鐘；失敗時 `"Preview unavailable"` placeholder + favicon + 重試按鈕；og:image 暫用 hotlink（M6 不做 proxy）
- **編輯 lock**：4 個 shape 都用 tldraw `editingShapeId` 作為 lock，第一人進編輯後其他人看 "正在編輯" badge 不可進入（避免 last-write-wins 吃字）
- **i18n**：所有 shape UI 字串走 `shapes.<name>.*` namespace，共用詞放 `shapes.common.*`；zh-TW + en 同 PR 同步
- **TDD scope**：parser、state machine、Copy / 語言切換、SSRF 整合、OG response 解析、lock 行為走 TDD；視覺（typography、配色、字距）走 preview

## Non-Goals (optional)

- **Slash command / cmd+k 入口**：M8 polish 再說，M6 只做 toolbar
- **og:image server-side proxy / cache**：phase 2 再優化，M6 用 hotlink + LRU
- **Code shape dark mode**：M8 brand 整合一起做
- **Markdown 的 math (KaTeX) / mermaid / Shiki-in-codefence**：scope creep，PRD 沒列
- **Mobile <768px**：phase 1 desktop-only 是既有 hard rule
- **CRDT 級多人編輯**：選 lock 而非 Y.js，理由是 markdown / code 通常單人編，CRDT 太重
- **Tier 2 shapes（mind-map / voting / table）**：PRD out-of-scope guard

## Capabilities

### New Capabilities

- `canvas-shapes`: 4 個 first-class custom shape (Markdown / Code / Callout / Link card) 的 schema、行為、渲染、編輯 lock、i18n、TDD 邊界

### Modified Capabilities

- `canvas-editor`: toolbar 多 4 個 shape 按鈕 + Link card 的「貼 URL 自動偵測」邏輯
- `multiplayer-sync`: 多人編輯 shape 時的 lock 機制（first-editor-wins，借用 tldraw `editingShapeId`）

## Impact

- 受影響 specs: `canvas-shapes`（新）、`canvas-editor`（modified）、`multiplayer-sync`（modified）
- 受影響程式碼:
  - 新增:
    - apps/web/src/canvas/shapes/markdown-shape.tsx
    - apps/web/src/canvas/shapes/markdown-shape.test.tsx
    - apps/web/src/canvas/shapes/markdown-parser.ts
    - apps/web/src/canvas/shapes/markdown-parser.test.ts
    - apps/web/src/canvas/shapes/code-shape.tsx
    - apps/web/src/canvas/shapes/code-shape.test.tsx
    - apps/web/src/canvas/shapes/code-highlight.ts
    - apps/web/src/canvas/shapes/code-highlight.test.ts
    - apps/web/src/canvas/shapes/callout-shape.tsx
    - apps/web/src/canvas/shapes/callout-shape.test.tsx
    - apps/web/src/canvas/shapes/link-card-shape.tsx
    - apps/web/src/canvas/shapes/link-card-shape.test.tsx
    - apps/web/src/canvas/shapes/link-card-state.ts
    - apps/web/src/canvas/shapes/link-card-state.test.ts
    - apps/web/src/canvas/shapes/use-shape-edit-lock.ts
    - apps/web/src/canvas/shapes/use-shape-edit-lock.test.ts
    - apps/web/src/canvas/shapes/index.ts
    - apps/web/src/canvas/ShapeToolbar.tsx
    - apps/web/src/canvas/ShapeToolbar.test.tsx
    - apps/api/src/og/index.ts
    - apps/api/src/og/index.test.ts
    - apps/api/src/og/parse-html.ts
    - apps/api/src/og/parse-html.test.ts
    - packages/shared/src/shapes/types.ts
    - docs/adr/0008-markdown-engine-marked.md
    - docs/adr/0009-shape-edit-lock-vs-crdt.md
    - docs/adr/0010-link-card-cache-two-tier.md
  - 修改:
    - apps/web/src/canvas/Editor.tsx（註冊 customShapes + ShapeToolbar）
    - apps/api/src/index.ts（掛載 /api/og 路由）
    - apps/api/src/lib/rate-limit-rules.ts（OG endpoint 規則）
    - packages/shared/src/locales/zh-TW.json（shapes.* namespace）
    - packages/shared/src/locales/en.json（shapes.* namespace）
    - apps/web/package.json（新增 marked / DOMPurify / shiki / lucide-react / @tailwindcss/typography 依賴）
