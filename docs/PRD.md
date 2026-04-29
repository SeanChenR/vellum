# Vellum — Phase 1 PRD

**Status:** Draft (locked after grill-me on 2026-04-29)
**Audience:** Project owner + future contributors (incl. Claude Code sessions)
**Phase:** 1 of N (Canvas-first foundation)

---

## Problem Statement

Vellum 的擁有者（個人 AI engineer，已購入長期 Claude 方案）想做一個**自己會用、感覺像正式產品的 canvas-based 協作工具**——風格上接近 Whimsical 的乾淨視覺，功能上具備真正的多人即時協作。

現有解法都不滿足這組需求：

- **tldraw.com**：沒有帳戶系統、canvas 是 ephemeral、無法整理收藏
- **Whimsical**：付費、閉源、無法自架、無法擁有自己的資料
- **Excalidraw**：手繪 / 草稿風格 vs. Whimsical 乾淨風格不同；商用 multiplayer 走外部服務
- **自架 Excalidraw / 自寫 Konva 應用**：要從零做 shape engine、CRDT、UI

擁有者的核心動機是**「不想做一半」**——不是衝使用者數，而是把它當作「練習做完整軟體產品」的載體。實作工作量不是約束（會由 Claude 寫），但決策品質與可審查性是約束。

## Solution

**Vellum** 是以 **tldraw SDK** 為底的 canvas-based 協作工具，phase 1 提供：

- 完整身份系統（Google OAuth + Magic Link）
- Canvas + 1 層 Folder 整理
- 客製 chrome（覆蓋 tldraw 預設 UI 為 Vellum 視覺語言）
- 4 個自製 shape（Markdown / Code / Callout / Link card）
- 即時多人協作（tldraw sync 自架在 Bun WebSocket 上）
- 兩種分享路徑（Email invite / Public link）+ 兩層權限（viewer / editor）
- 5 種匯出格式（JSON / PNG / SVG / PDF / Markdown）
- 雙語介面（zh-TW / en）
- 完整 anti-abuse（rate limit + SSRF guard）

技術選型走 **Bun-native 路線**（runtime / package manager / test runner / WebSocket / bundler 全用 Bun）配合 **oxc**（lint / format），並透過 **Drizzle + Postgres on Neon** 持久化。Phase 1 純 localhost 開發，hosting 議題凍結到完成後再決定。

## User Stories

### 身份 / 帳戶

1. As a 新訪客，I want 看到 Vellum 的 landing page，so that 我能理解這是什麼工具
2. As a 新訪客，I want 用 Google OAuth 登入，so that 我能快速開始用
3. As a 新訪客，I want 用 Magic Link 登入，so that 沒 Google 帳號也能用
4. As a 已登入使用者，I want 從個人選單登出，so that 我能在共用電腦保護隱私
5. As a 已登入使用者，I want 修改顯示名稱與頭像，so that 我能個性化
6. As a 已登入使用者，I want 切換 UI 語言（zh-TW / en），so that 用熟悉的語言操作
7. As a 已登入使用者，I want 看到我所有 active session 並可遠端登出，so that 能 audit 安全
8. As a 已登入使用者，I want 永久刪除帳號連同所有資料，so that 行使資料權

### Dashboard / Canvas 管理

9. As a 已登入使用者，I want 在 dashboard 看到「我的 canvases」與「Shared with me」兩區，so that 能快速分辨擁有與被分享
10. As a 已登入使用者，I want 建立新 canvas，so that 開始畫
11. As a 已登入使用者，I want 重新命名 canvas，so that 維護整潔
12. As a 已登入使用者，I want 刪除 canvas，so that 清掉不要的
13. As a 已登入使用者，I want 建立 1 層 folder 分類 canvas，so that 整理收藏
14. As a 已登入使用者，I want 把 canvas 拖進 / 拖出 folder，so that 重新整理
15. As a 已登入使用者，I want 重新命名 / 刪除 folder，so that 維護分類
16. As a 已登入使用者，I want 看到 canvas 縮圖與最後編輯時間，so that 找到最近用過的

### Canvas 編輯體驗

17. As a 已登入使用者，I want 進入 canvas 編輯器看到 Vellum chrome（不是 tldraw 預設 UI），so that 體驗一致
18. As a 已登入使用者，I want 用 tldraw 內建工具（pencil、shapes、sticky、text、arrow with binding），so that 自由創作
19. As a 已登入使用者，I want 在 canvas 內加 Markdown 區塊，so that 放格式化文字
20. As a 已登入使用者，I want 在 canvas 內加 Code 區塊（語法高亮），so that 放程式碼片段
21. As a 已登入使用者，I want 在 canvas 內加 Callout / Quote 區塊，so that 強調某段內容
22. As a 已登入使用者，I want 貼網址自動轉 Link card（顯示 OG metadata 預覽），so that canvas 上有美觀連結
23. As a 已登入使用者，I want 編輯被自動持久化，so that 不擔心遺失

### Multiplayer 協作

24. As a 已登入使用者，I want 跟別人即時共編同一張 canvas，so that 一起腦力激盪
25. As a 協作者，I want 看到其他人的 cursor 位置，so that 知道大家在看哪
26. As a 協作者，I want 看到其他人的選取狀態，so that 知道誰在動什麼
27. As a 協作者，I want 看到目前在 canvas 上所有協作者頭像列表，so that 一眼了解現場
28. As a 協作者，I want 即使網路短暫斷線重連也能繼續編輯，so that 中斷不會搞丟工作
29. As a 匿名訪客（透過 public-link-edit），I want 被自動指派 anonymous 名字（如 "Anonymous Owl"），so that 能參與編輯而不暴露身份

### Sharing

30. As a canvas owner，I want 用 email 邀請特定人，so that 能跟同事協作
31. As a canvas owner，I want 產生 public link 讓任何人觀看，so that 分享給沒帳號的人
32. As a canvas owner，I want public link 三檔切換（closed / link-view / link-edit），so that 控制風險
33. As a canvas owner，I want 隨時 rotate share link（讓舊 link 失效），so that 撤回外流存取
34. As a canvas owner，I want 把已邀請成員的權限改成只讀，so that 降權
35. As a canvas owner，I want 移除已邀請的成員，so that 撤回存取
36. As 收到 invite 的使用者，I want 點 email 連結後註冊 / 登入直接進 canvas，so that 無痛開始協作
37. As 拿到 public link 的訪客，I want 不用登入就能看 canvas（owner 開放時），so that 快速 review

### Export

38. As a canvas owner，I want 匯出 PNG，so that 貼到 Slack / 簡報
39. As a canvas owner，I want 匯出 SVG，so that 拿到向量原始檔
40. As a canvas owner，I want 匯出 PDF，so that 列印或寄客戶
41. As a canvas owner，I want 匯出 JSON snapshot，so that 備份或搬移
42. As a canvas owner，I want 匯出 Markdown（只導 Markdown shapes），so that 拿去發部落格
43. As a canvas owner，I want 選擇匯出整張或選取區，so that 只匯出感興趣的部分
44. As a canvas owner，I want 選擇 PNG/PDF 解析度（1×/2×/4×），so that 依使用情境調整

### Anti-abuse / Reliability

45. As a 系統，I want 對 Magic Link request rate-limit（per email 3 次/10min；per IP 10 次/hr），so that 不被人發大量垃圾信
46. As a 系統，I want 對 login 嘗試 rate-limit（per IP 10 次/min），so that 防 brute force
47. As a 系統，I want 對 canvas CRUD / share / WS rate-limit，so that 防 DoS
48. As a 系統，I want OG scrape API 嚴格 SSRF 防護（拒絕 RFC1918 / loopback / 非 http(s)；cap size + timeout），so that 不變成 abuse 工具

### A11y

49. As a 鍵盤使用者，I want Tab 走完所有 UI 元件，so that 不需滑鼠也能用
50. As a 螢幕閱讀器使用者，I want 所有元件有 ARIA label，so that 能聽懂介面
51. As a 已登入使用者，I want dialog / toast 出現時 focus 自動 trap，so that Tab 不會跳出去

---

## Implementation Decisions

### 技術 Stack

- **Runtime / PM / Test / WS / Bundler**：Bun（單一 binary，全包）
- **Lint / Format**：oxlint + oxfmt
- **Pre-commit**：Husky + lint-staged
- **前端**：React 18+ + tldraw SDK（最新穩定）
- **CSS / UI**：Tailwind v4 + shadcn/ui（基礎元件）+ MagicUI（landing 重動畫）+ Animate UI（app 內微動畫）；共用 motion
- **Routing**：TanStack Router（type-safe params + search params）
- **State**：TanStack Query 為 server state 主要管理；Zustand 補位 client-only state
- **Form**：react-hook-form + zod
- **字型**：Inter（UI sans）+ Newsreader（serif accent）
- **DB / ORM**：Postgres on Neon + Drizzle ORM
- **Auth**：better-auth（Google OAuth + Magic Link）
- **Email**：phase 1 用 Mailpit local Docker container；phase 2 改 Resend（3k/mo free tier）；template 用 React Email
- **Realtime**：tldraw sync 自架在同一個 Bun.serve process
- **Logging**：Pino → stdout
- **i18n**：i18next + react-i18next；zh-TW / en；Claude 翻譯；自動偵測 + 設定頁切換器
- **Code organization**：Bun workspace monorepo（`apps/web` + `apps/api` + `packages/shared`）

### 模組劃分

**Frontend（`apps/web`）**

- Auth Module（login 頁、OAuth callback、Magic Link 流程、session）
- Dashboard Module（canvas list、folder UI、Shared with me）
- Canvas Editor Module（tldraw 整合 + 客製 chrome）
- Custom Shapes（4 個獨立模組）
- Sharing UI Module
- Export Module（5 格式）
- Settings Module（個人 / 語言 / session / 帳號刪除）
- Landing Page
- i18n Module
- Brand Tokens

**Backend（`apps/api`）**

- Auth Service（better-auth + OAuth + Magic Link sender）
- Canvas API
- Folder API
- Sharing API
- Sync Server（tldraw sync WebSocket handler、room state、jsonb persistence）
- OG Scrape API（含 SSRF guard）
- Email Service（`EmailService` interface，Mailpit / Resend impl）
- Rate Limiter Middleware（in-process token bucket）
- Logger（Pino structured）

**Shared（`packages/shared`）**

- Drizzle Schema（table 定義 + migration source）
- API Contract types
- Shape Type Defs（4 個 custom shape）
- Locale JSON（zh-TW / en）
- Zod Schemas（form + API 共用）

### 抽出的 Deep Modules（純函式 / 易測試）

- **SSRFValidator**：`validateExternalUrl(url) → Result<URL, ValidationError>`，拒 RFC1918 / loopback / link-local / 非 http(s)
- **RateLimiter**：`limit(key, rule) → { allowed, retryAfter }`，內部 LRU + token bucket
- **OGParser**：`parseOG(html) → OGMetadata`，cheerio-based，跟 fetch 解耦
- **PermissionChecker**：`canAccess(user, canvas, action) → boolean`，純規則
- **ShareTokenService**：`generate() / validate(token) → CanvasId`，crypto-safe random + constant-time compare
- **CanvasSnapshotCodec**：`toDb(state) / fromDb(jsonb) → tldraw state`，序列化往返
- **EmailTemplateRenderer**：`render(name, data) → { html, text }`，跟 SMTP 解耦
- **MarkdownShapeRenderer**：`render(markdown) → ReactNode`，純渲染

### 資料 Model（Drizzle Schema 高層次）

- `users`（id, email, name, image, locale, created_at）
- `sessions`（better-auth 標準 schema）
- `accounts`（OAuth provider link，better-auth 標準）
- `magic_links`（token, email, expires_at, used_at）
- `folders`（id, owner_id, name, created_at, updated_at）
- `canvases`（id, owner_id, folder_id nullable, title, snapshot jsonb, created_at, updated_at）
- `canvas_shares`（canvas_id, user_id, role enum<viewer|editor>, created_at）
- `canvas_share_links`（canvas_id, token unique, mode enum<closed|view|edit>, created_at, rotated_at）

### API Contract 高層次

- REST endpoints 全走 `/api/*`，回傳統一 envelope `{ data, error }`
- Server 回 error 用 `errorKey` 字串（i18n key）不回翻譯後文字
- WS 走 `/sync/:canvasId`，連線時帶 session token / share link token；server 用 PermissionChecker 驗證後才接受
- OG scrape：`GET /api/og?url=<encoded>`，回 `{ title, description, image, siteName, favicon }` 或 error

### Sharing 邏輯

- 「我的 canvases」內所有 canvas owner 都是 user
- 「Shared with me」是 user 在 `canvas_shares` 表中有 row 的 canvases
- Public link 三檔切換改的是 `canvas_share_links.mode`（不會新增 row，不會刪 row，永遠一張 canvas 對應一個 link record）
- Owner 永遠不能離開自己的 canvas（要先轉 ownership 或刪除）
- 沒有「申請存取」功能：拿不到 link / 沒被 invite 就看不到
- 匿名訪客（透過 public-link）顯示 anonymous 動物名（tldraw sync 內建）

### tldraw 整合策略

- 使用 tldraw SDK；用 `<Tldraw>` 元件嵌入到自定 layout
- 替換 chrome：頂部 bar、share button、主選單（File-style 含匯出）、share dialog 全部自寫
- 保留 tldraw 預設：右側 / 底部 toolbar、shape 工具、選取 / 變形 / 對齊 / undo / 鍵盤捷徑
- 4 個 custom shape 透過 tldraw 的 `defineShape` API 註冊
- Single-page document（不啟用 tldraw multi-page）
- Phase 1 保留 tldraw 浮水印（免費 license 合規）

---

## Testing Decisions

### TDD 紀律

**邏輯走 TDD（red-green-refactor）；視覺走預覽迭代。**

- 寫 feature 前先給 user 看 test plan + 失敗的 test，確認後才實作
- Coverage 門檻：**70%**（不設 80%，避免測 canvas 渲染這種低價值區塊）

### 測試金字塔

**單元測試（`bun test`）**

對全部 8 個 deep modules 嚴格走 TDD：

- SSRFValidator（窮舉 RFC1918 / loopback / link-local / valid）
- RateLimiter（邊界、窗口移動、不同 key 隔離）
- OGParser（malformed HTML、缺欄位、編碼）
- PermissionChecker（owner / shared editor / shared viewer / public-edit / public-view / no-access 6 矩陣）
- ShareTokenService（碰撞機率、constant-time 驗證）
- CanvasSnapshotCodec（序列化往返不變、向後相容性）
- EmailTemplateRenderer（template missing、xss 防護、變數替換）
- MarkdownShapeRenderer（標準 markdown subset、xss、code fence）

**Server Integration Tests（`bun test`，跑 Neon test branch）**

- Auth：OAuth callback / Magic Link 驗證 / session 建立 / session 撤回
- Canvas / Folder API：CRUD 邊界、permission 拒絕、404
- Sharing API：invite、link rotation、權限矩陣
- Sync Server：room 加入時 permission gate、CRDT 收斂、disconnect cleanup
- OG Scrape API：SSRF 拒絕、size cap、timeout cap

**Component Tests（`bun test` + happy-dom + Testing Library）**

只測**互動行為**，不測樣式：

- Auth UI（login form、Magic Link 送出 / 進度顯示）
- Dashboard UI（canvas list 互動、folder drag、context menu）
- Sharing UI（invite form、link mode 切換、rotate 流程）
- TopBar / MainMenu / ShareDialog（開合、focus trap、keyboard 操作）
- Settings UI（語言切換、session 列表、刪除帳號 confirm flow）

**E2E Tests（Playwright）**

5 條 happy path：

1. **Login**：Magic Link 發送 → 收信 → 點 link → 成功進 dashboard
2. **Canvas CRUD**：建立 → 重新命名 → 拖進 folder → 刪除
3. **Sharing**：invite 第二個帳號 → 對方接受 → 兩人都看到 canvas
4. **Multiplayer**：兩個 browser context 同時編輯同一張 canvas → 互相看到對方變更與 cursor
5. **Export**：開啟 canvas → 從 menu 匯出 PNG → 下載成功

### 不寫測試的範圍

- 4 個 Custom Shape 的視覺（layout / 字體 / 間距）
- Canvas Editor 整合的視覺（tldraw 自帶測試）
- Landing Page 視覺
- Brand Tokens（純宣告）
- Locale JSON（不是邏輯）

### 測試組織

- Test 檔 colocate（`Foo.test.tsx` 與 `Foo.tsx` 同層）
- Server integration test 放 `apps/api/src/**/*.test.ts`
- E2E test 放 `e2e/` 或 `tests/e2e/`，與 source 分離（Playwright config 慣例）

---

## Out of Scope

**Phase 1 不做**：

- Mobile / phone 響應式（< 768px）
- Comment / annotation / @mention / 通知
- Multi-page canvas（一個 canvas 一頁）
- Mind-map auto-layout / Voting / Table 等 Tier 3 custom shapes
- Wireframe / UI mock 元件庫
- AI 整合（任何形式）
- 自有 collaboration cursor presence avatar 系統（沿用 tldraw 內建）
- 圖片上傳到 cloud storage（tldraw 內建 image shape 用 base64 / object URL）
- Embed 嵌入到第三方網站（iframe API）
- Real-time activity log / version history UI
- Production 部署（hosting deferred）
- Sentry / OpenTelemetry / 分散式 tracing
- Analytics（PostHog / Plausible 等）
- 真寄信（Resend）— 用 Mailpit 替代
- 域名 / 自訂 domain
- Offline / PWA / service worker
- Public canvas discovery / search
- 申請取消 tldraw 浮水印的 commercial license

---

## Further Notes

### Phase 進程

**Phase 1**：Day 1 Scaffolding + M1 Auth → M10 Test 補位（≈ 9 週 Claude+review 節奏）

**Phase 2 候選**：Mobile / Comment / Sentry / Analytics / Resend / Deploy / 自訂 domain / Multi-page

**Phase 3+ 候選**：Mind-map / Voting / Table / Wireframe / iframe embed / version history / Public discovery

### Hosting 路線（phase 1 完成後再選）

- Cloudflare Tunnel（$0，自家機器當伺服器）
- Fly.io（$5/mo，最推薦）
- Railway（$5/mo，最簡單 git push）

完整 deploy checklist 在 memory `project_deploy_checklist.md`：必補 Sentry、secrets store、HTTPS、CORS、CSP headers、migration 流程確認。

### 動畫紀律

- Landing / Dashboard / Dialog / Toast：用 motion + MagicUI / Animate UI
- Canvas 內部（tldraw 區）：不額外加動畫（會跟 tldraw 內建衝突）
- Multiplayer cursor / presence：不加動畫（必須 instant feedback）

### 安全基本盤

- SSRF guard 為所有對外 fetch 必過
- Rate limit 為所有 endpoint 預設啟用
- Server 永遠不回翻譯後 error 字串，回 errorKey
- Phase 2 deploy 前必加 Sentry + secrets store 遷移 + CSP headers

### License

- Vellum 自身：phase 1 結束前決定（候選 MIT / AGPL）
- tldraw：免費 license + 留浮水印（phase 2 評估申請免費商用 license）

### 翻譯紀律

每個新 feature 加新 string 時，**zh-TW + en 兩邊同步補齊**——只加 zh-TW 會讓 en 漸漸落差。Claude 在開發新 feature 時自動產出翻譯 + user review。

### Test-First 紀律

Claude 寫 feature 前**先給 user 看 test plan / 失敗的 test，user 同意後才實作**——不要「寫完 code 再補測試」。
