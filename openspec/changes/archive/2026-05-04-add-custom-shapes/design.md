## Context

vellum 的 canvas 殼（M3）+ tldraw sync（M4）+ sharing（M5.5）已就緒，但目前 user 只能在 canvas 上畫圖，沒辦法放結構化內容。M6 要把 vellum 從「白板」升級為「能放真正內容的協作畫布」。

技術環境約束：
- 前端 React 19 + tldraw SDK（已 embed 在 apps/web/src/canvas/Editor.tsx）
- 後端 Bun.serve 單一 binary，已有 deep module：`RateLimiter`、`validateExternalUrl`、Drizzle ORM
- snapshot 走 jsonb 持久化，shape props 即 snapshot 內容
- multiplayer 走 tldraw sync（tldraw shape props 預設 last-write-wins）

利害關係人：vellum 的 owner（單人專案 + craftsmanship 取向）；review 而非實作工作量是成本。

## Goals / Non-Goals

**Goals:**

- 4 個 first-class custom shape（Markdown / Code / Callout / Link card）能在 canvas 建立、編輯、序列化（snapshot）、多人同步
- shape 編輯時 **first-editor-wins lock**，避免 last-write-wins 吃字
- shape parser、state machine、Copy / 語言切換、SSRF 整合、OG 解析、lock 行為**全部走 TDD**；視覺走 preview 迭代
- 所有 shape UI 文字走 `shapes.<name>.*` i18n namespace，zh-TW + en 同 PR 同步
- 新增 `POST /api/og` SSRF-safe OG metadata endpoint，rate limit 30/min/user，cache 兩層
- 入口透過 tldraw toolbar + Link card 額外支援「貼 URL 自動偵測」

**Non-Goals:**

- Slash command / cmd+k 入口（M8 polish）
- og:image server-side proxy（phase 2）
- Code shape dark mode（M8 brand 整合一起做）
- Markdown 的 math (KaTeX) / mermaid / Shiki-in-codefence
- CRDT 級 collaborative 編輯（選 lock 取代）
- Mobile <768px（phase 1 desktop-only 既有 hard rule）
- Tier 2 shapes（mind-map / voting / table）— PRD out-of-scope guard

## Decisions

### Markdown engine: marked + DOMPurify

選 `marked`（vs `markdown-it` plugin 多但較重 / `unified+remark` 生態大但 setup 複雜）。理由：
- bundle size 小（~30KB gz），符合 vellum「盡量輕」的偏好
- API 簡單，pure function 容易 TDD 測試（給 markdown 字串、期望 HTML 字串）
- GFM 支援足夠：table / task-list / strike / autolink 都有官方 extension
- 不需要 plugin 生態（math / mermaid 都是 non-goal）

`DOMPurify` 是 sanitize 必裝（user 可能貼帶 `<script>` 的 markdown）。在 marked render 之後跑一次。**deep module**：`apps/web/src/canvas/shapes/markdown-parser.ts` 包成單一 `parseMarkdown(input: string): string` pure function，內部串 marked + DOMPurify，error 不漏（return safe HTML 即使 input 是 garbage）。

ADR: docs/adr/0008-markdown-engine-marked.md

### Code highlight: Shiki lazy-load + 12 語言精選

選 `Shiki`（vs `Prism` token 粗、`highlight.js` 中庸）。理由：
- 顏色比另兩個都美（用 VS Code 的 TextMate grammar）
- 支援 async load grammar，避免 main bundle 爆
- 風格 token 化（不只 `<span class="...">`，而是 `<span style="color:...">`）→ 不依賴外部 CSS theme

精選 12 種語言（JS / TS / Python / Go / Swift / Rust / HTML / CSS / SQL / Bash / Markdown / JSON）覆蓋 vellum owner 個人 stack（Python / TS / Swift / Go）+ 通用語言。每個語言 grammar 獨立 lazy-load，user 第一次切到該語言時才載入。

**deep module**：`apps/web/src/canvas/shapes/code-highlight.ts` 包成 `highlightCode(source, lang)` 回傳 `{ tokens, error }`；error 不擲（unknown lang fallback to plain text）。

### Shape edit lock: 借用 tldraw `editingShapeId`（first-editor-wins）

vs (a) last-write-wins / (b) Y.js CRDT。選 lock 理由：
- markdown / code / callout 通常單人在編，多人同改是罕見場景
- LWW 太粗暴：用戶 B 在 A 還沒結束時打字，A 一 save 就吃掉 B 的字
- CRDT 太重：Y.js 對 vellum 既有 jsonb-snapshot 持久化模型不友善，且 4 個 shape 都要實作 CRDT 是巨量工作
- tldraw 內建 `editingShapeId` 是已知欄位，已透過 sync 廣播；用它做 lock 幾乎零成本

**機制**：custom hook `useShapeEditLock(shapeId)` 回傳 `{ canEdit, lockedBy }`，內部 read tldraw store 的 `editingShapeId` + presence。當 `editingShapeId === shapeId && presence.userId !== self`：`canEdit: false, lockedBy: <other user>`。其他 user 看到「正在編輯」badge 不可雙擊進入。

ADR: docs/adr/0009-shape-edit-lock-vs-crdt.md

### Link card cache: snapshot + server LRU 兩層

vs (a) 純 client-side snapshot only / (b) 純 server LRU。選兩層理由：
- snapshot 內存最後 OG 結果讓 user 重整 page 不閃白（craftsmanship 細節）
- server LRU 30 分鐘防止 user 連點重整鍵對外站狂打（rate limit 之外的第二層保護）
- 兩層獨立失效：snapshot 是 shape props 一部分（重整 web 不掉），LRU 是 in-memory（重啟 server 掉但 acceptable）

**re-scrape trigger**：(1) 貼 URL 時、(2) URL 編輯後、(3) 結果 24 小時前的 timestamp、(4) user 按重整。

**deep module**：`apps/api/src/og/index.ts` `POST /api/og`，內部 `validateExternalUrl()` → `fetch(url)` → `parseHtmlForOg(html)` → 回傳 envelope。LRU key 是 normalized URL。`apps/api/src/og/parse-html.ts` 是 pure HTML parsing function（給定 HTML 字串，回 OG metadata），TDD 100%。

ADR: docs/adr/0010-link-card-cache-two-tier.md

### Shape entry point: toolbar 4 buttons + paste-detect Link card

vs (a) slash command / cmd+k / (b) toolbar only / (c) right-click menu。選 toolbar + paste-detect 理由：
- toolbar 是 tldraw 既有 UI surface，不破壞 tldraw 一致性
- 4 個按鈕 lucide icon 即可，不需新 modal
- Link card 是個特例：user 通常從別處「貼」URL 進 canvas，paste-detect 把這個 friction 拿掉
- 其他 shape 的 paste-detect（如 markdown table 文字）暫不做，只 Link card

**入口位置**：tldraw toolbar bottom，4 按鈕排在 select / draw / arrow 之後。

### TDD scope 邊界

| 項目 | TDD | Preview |
|---|---|---|
| Markdown parse + sanitize 結果（given input → expect HTML 字串） | ✓ | |
| Markdown shape 雙擊 → dialog 開啟、blur → 關閉、save 寫 props | ✓ | |
| Markdown shape 視覺（typography、表格樣式） | | ✓ |
| Code highlight token output（Shiki 對特定 source 的 token） | ✓ | |
| Code shape Copy 按鈕邏輯、語言切換邏輯 | ✓ | |
| Code shape 配色 / 字距 | | ✓ |
| Callout variant → i18n key 對應 | ✓ | |
| Callout body inline markdown render（subset） | ✓ | |
| Callout 視覺 | | ✓ |
| Link card OG response 解析（HTML fixture → parsed obj） | ✓ | |
| Link card SSRF 拒絕（既有 validateExternalUrl 已測，多打整合 test） | ✓ | |
| Link card state machine（pending / success / error / retry） | ✓ | |
| Link card 圖片載入失敗 fallback | | ✓ |
| Toolbar 4 按鈕視覺 + Insert flow | | ✓ |
| Shape edit lock：第二人看到 lock badge | ✓ | |

## Risks / Trade-offs

- **Shiki bundle 大** → lazy-load + 限定 12 語言，user 沒插 Code shape 時不載
- **DOMPurify XSS bypass 風險（CVE 史）** → 跟 marked / DOMPurify 維護版本，CI 跑 dependency audit；GFM 限制 raw HTML（marked 預設 `mangle: false` + 不開 `breaks`）
- **OG hotlink 圖片可能掛掉 / referrer leak** → M6 接受 risk（owner 的 trade-off：phase 2 再做 server proxy）；圖片 onError 切到 fallback placeholder
- **Lock 機制 stale lock 風險**（user 突然關 tab，editingShapeId 沒清掉）→ tldraw 內建 presence heartbeat，斷線後 N 秒自動清；額外加 5 分鐘超時 fallback（在 lock badge 上判斷 `presence.lastActiveAt`）
- **`marked` 跟 `@tailwindcss/typography` 樣式衝突** → 透過 `prose` class scope，shape root element 加 `prose prose-sm` 限縮影響範圍
- **Multi-shape paste 行為衝突**（user 同時貼多 URL）→ paste handler 只處理 single URL；multi-line 直接走 markdown shape

## Migration Plan

純前端 + 新後端 endpoint，**無 DB schema 變更**（shape props 走 snapshot jsonb，schema-less）。

部署順序：
1. 先 land 後端 `POST /api/og`（無 client 用，不影響現狀）
2. 再 land 前端 4 shapes + ShapeToolbar + Editor.tsx 註冊
3. i18n key 同 commit 補齊 zh-TW + en

回滾策略：
- 純還原前端：existing snapshot 內若已有 custom shape，tldraw 在沒有對應 ShapeUtil 時會 silently skip render（變空 area），不會 crash
- 後端 endpoint 直接拿掉，client 沒人 call

## Open Questions

無——所有重大選擇 discuss 階段已釘住。
