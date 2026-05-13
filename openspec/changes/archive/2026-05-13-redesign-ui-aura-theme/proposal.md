## Why

目前 Vellum 的 UI 是 Phase 1 一路加上去的 Swiss-modern 編輯風格，幾個明顯問題已經累積到該重做：

1. **頁面寬度不一致** — Navbar / Footer / Dashboard 用 `max-w-6xl`，About 用 `max-w-3xl`，Sessions 用 `max-w-2xl`，Profile 用 `max-w-lg`，ApiKeys 用 `max-w-2xl`。每換一個 route 內容就「縮腰」一次，視覺斷層明顯。
2. **沒有深色主題** — `apps/web/src/store/uiStore.ts` 有 `theme: "light" | "dark"` state 但沒 toggle、沒 CSS variables、沒 `html[data-theme]`。canvas 內 AI Side Panel + 對話氣泡都是寫死亮底，深色 OS 偏好的使用者體驗差。
3. **語言切換埋在 ProfilePage 表單裡** — 使用者要切繁中 / 英文得登入 → 點頭像 → 進個人資料 → 改 locale → 儲存。應該是 Navbar 一鍵切換。
4. **Navbar 沒中央區段** — 主要 nav (`首頁` / `關於`) 跟右側登入按鈕擠在右邊，視覺密度高、無法擴展。
5. **品牌色 (`warm-sepia`/`parchment-cream`/`ink-navy`/`off-white`) 看起來偏「教科書」**，使用者想換成更現代、帶點科技感的 Aura Theme 配色，且 Aura 是 LLM-friendly 的對比度配色，深色尤其符合 canvas-as-co-pilot 的氣質。

Claude Design 已交付完整 design bundle (`docs/design/aura-redesign/`)，含 9 個 route × 2 主題 high-fidelity mockup、`tokens.css`、Component spec sheet（Card / Button / Input / NavBar / Footer / Dialog / Badge），可直接落地。

**Ingest update（2026-05-13）**：第一輪 token 化交付後，使用者比對 design 發現視覺結構落差大（Dashboard / Account 系列仍是舊版型）。本 ingest 把 Dashboard 重做 + Account 三條 route 合併成單一 tab page 補進來。範圍仍在本 change 內，不另立 milestone。

調整重點：

6. **Dashboard 重做**：左 sidebar 含資料夾列表（active state 用 `accent-purple-soft` bg + accent-purple 文字）、tag chips、頂端 greeting 列 + 日期 + 搜尋輸入 + 排序切換（最近編輯 / 字母排序），右側 canvas 卡片網格。**不做訂閱 / Studio 升級 callout**（vellum 沒有訂閱模式）。
7. **Account 合併為 tab page**：`/account/profile`、`/account/sessions`、`/account/api-keys` 合併進 `/account` 一個 route，內部用 tab 切換「個人資料」、「登入裝置」、「API 與 MCP」三個 panel。多一個 tab「定價」放既有 BYOK 定價內容（取代 design 中的訂閱 tab）— 9 個 model 改用視覺化呈現（每個 provider 三 tier 用 elevated card group），不再純表格。
8. **API 與 MCP 區塊重做**：BYOK rows 改 design 風格（provider logo + masked key + 行動按鈕 inline、saved 狀態用 cyan dot badge）、PAT 列表用 design 的 row layout（name + masked prefix + last used + expires + revoke）+ create dialog 的 plaintext reveal 用 `accent-cyan-soft` 區塊 + copy button 走 design rhythm。

## What Changes

### 新增 capability: `theme-switching`

- `useTheme()` hook + Zustand store 持久化偏好（`system` / `light` / `dark`，預設 `system`）
- `<html data-theme="light|dark">` 寫法；`system` 模式訂閱 `prefers-color-scheme` 媒體查詢
- Navbar 右側放 `<ThemeToggle />` icon button（lucide `Sun` / `Moon` / `Monitor`）
- AI Side Panel + ChatComposer + 對話氣泡 + canvas chrome (TopBar / MainMenu) 全部讀 CSS custom properties，深色模式自動跟著切

### 新增 capability: `locale-switching`

- Navbar 右側放 `<LocaleToggle />` icon button（lucide `Languages` + 顯示 `中` / `EN`）
- 點擊展開下拉選 `繁體中文` / `English`
- 寫入 `i18n.changeLanguage()` + 已登入時同步 patch `/api/account/profile` 的 `locale` 欄位
- ProfilePage 移除 locale select 欄位（avatar + name 留著）

### Modified: `public-pages`

- 統一所有 non-canvas page 容器為 `max-w-6xl` (1152px) + `px-6 md:px-8`
- Navbar 改三欄 grid `[1fr · auto · 1fr]`：左品牌、中 nav links、右 (locale + theme + auth)
- About long-form prose 內層自設 `max-w-prose`，但外層仍 `max-w-6xl`
- HomePage 三張 feature card 升級為 `elevated` 變體 + accent-purple hover ring
- Footer 配色改 token 化

### Modified: `account`

- ProfilePage 改 elevated card；avatar URL + 名字並排；移除 locale field
- SessionsPage 每個 session 一張 card row；當前 session 帶 cyan badge `這台裝置`
- ApiKeysPage 重組為兩個 section：(A) Provider Keys card grid，(B) MCP Tokens 列表
- 新增 `<Card>`、`<Button>`、`<Input>`、`<Badge>` primitives（從 design components.jsx 抽出來成 shadcn-style component）

### Modified: `auth`

- LoginPage / MagicLinkVerifyPage / InviteErrorPage 三個 page 統一使用 elevated card layout 置中

### Modified: `motion-system`

- 不更動現有 motion primitives，但 Card hover 加 150ms transform + accent-purple ring
- Theme switch 是 instant（不加 transition）— 閃爍比跳動更糟

### Modified: `account`（ingest 補強）

- 三條既有 route `/account/profile` `/account/sessions` `/account/api-keys` 合併成單一 `/account` route，內部用 tab 切換四個 panel：「個人資料」、「登入裝置」、「API 與 MCP」、「定價參考」。
- 舊路徑保留 redirect 行為（`/account/profile` → `/account?tab=profile` 等），避免外部連結失效。
- 「定價參考」tab 把既有 `ApiKeysPricingTable`（9 個 model × input/output token 價錢）改成卡片式視覺：每個 provider 一張 elevated card，內含 3 個 tier rows（旗艦 / 平衡 / 經濟），每 row 顯示模型 ID + input / output 價錢 + tier badge 著色（旗艦 purple / 平衡 cyan / 經濟 muted）。
- 「API 與 MCP」tab 採 design frame 風格：provider rows 不再各佔一個 Card（改成單一 elevated container + 三個 row 內 divider），masked key 用 `font-mono` + saved 狀態用 cyan dot badge `已連線`、replace / delete 走 ghost / destructive 按鈕。MCP Tokens 用 row 佈局含 prefix monospace + last-used 相對時間 + expires + revoke 按鈕。

### Modified: `public-pages`（ingest 補強 — Dashboard 重做）

- DashboardPage 改 design 風格：頂端 greeting 區（含日期 + 歡迎詞 + 搜尋輸入 + 「新畫布」CTA），左 sidebar 含 (a) 資料夾列表（active item 用 `accent-purple-soft` bg + `accent-purple` 文字），(b) tag chips（Badge primitive，預設 `purple` / `cyan` / `orange` tones），(c) 排序切換（最近編輯 / 字母排序 ghost buttons）。
- 右側 canvas 卡片網格用 `<Card variant="hover-ring">` + thumbnail 區（16:10 aspect ratio）+ role badge（owner=purple、editor=cyan、viewer=muted）+ 標題 + last-edited 相對時間（font-mono）。
- **不做訂閱 / Studio 升級 callout**（vellum 沒有訂閱模式）— design 該位置改放 phase 1 / phase 2 完工度 badge 或留白。

### 設計 token 整合

- `apps/web/src/styles.css` 套用 `docs/design/aura-redesign/project/tokens.css` 的 light + dark token map（11 個 accent / surface / text 變數 × 2 mode）
- Tailwind v4 `@theme inline` 對應 CSS custom properties，讓 `bg-surface` / `text-primary` / `border-border` 等 utility class 直接用
- 既有品牌 token (`warm-sepia` 等) 在重構期保留為 alias 指到新 token，所有 component class 重命名後再清除

## Non-Goals

- 不動 tldraw 畫布內部渲染（shape / cursor / arrow 等）— tldraw 自帶 theming，整合留 follow-up
- 不重做 canvas editor 的 TopBar / MainMenu 內容（功能不動）— 只換配色 token + 對齊 dark mode
- 不加 mobile-first redesign — desktop 仍主要 surface；mobile (<768px) 走 graceful fallback，hamburger collapse 列為 P2
- 不引入新動畫 library — 沿用 `motion`
- 不改既有 i18n key 結構 — 純加 `nav.theme.*` / `nav.locale.*` 新 keys，舊 keys 不動

## Capabilities

### New Capabilities

- `theme-switching`: System-aware light/dark mode toggle with persisted user preference and CSS custom property–driven runtime switching across the entire app surface.
- `locale-switching`: One-click language toggle in the navbar that updates both i18next runtime and the server-persisted user locale preference (when signed in).

### Modified Capabilities

- `public-pages`: NavBar three-region grid layout, unified container width, themed Footer. Dashboard redesigned with greeting strip, search input, folder + tag sidebar, sort toggles, and themed canvas grid.
- `account`: Three existing routes (profile / sessions / api-keys) collapsed into a single `/account` route with internal tabs (Profile · Sessions · API & MCP · Pricing reference); legacy routes redirect to the new tab anchors. Pricing tab replaces the previous flat table with provider-grouped tier cards.
- `auth`: LoginPage / MagicLinkVerifyPage / InviteErrorPage redesigned with elevated card layout.
- `motion-system`: Card hover ring transition added; theme switch is instant.

## Impact

- Affected specs: theme-switching (new), locale-switching (new), public-pages (modified), account (modified), auth (modified), motion-system (modified)
- Affected code:
  - New:
    - apps/web/src/theme/useTheme.ts
    - apps/web/src/theme/ThemeToggle.tsx
    - apps/web/src/theme/ThemeToggle.test.tsx
    - apps/web/src/theme/theme-provider.tsx
    - apps/web/src/theme/theme-provider.test.tsx
    - apps/web/src/i18n/LocaleToggle.tsx
    - apps/web/src/i18n/LocaleToggle.test.tsx
    - apps/web/src/components/ui/Card.tsx
    - apps/web/src/components/ui/Button.tsx
    - apps/web/src/components/ui/Input.tsx
    - apps/web/src/components/ui/Badge.tsx
    - apps/web/src/components/ui/Card.test.tsx
    - apps/web/src/components/ui/Button.test.tsx
    - apps/web/src/components/ui/Input.test.tsx
    - apps/web/src/components/ui/Badge.test.tsx
    - apps/web/src/account/AccountPage.tsx
    - apps/web/src/account/AccountPage.test.tsx
    - apps/web/src/account/Tabs.tsx
    - apps/web/src/account/Tabs.test.tsx
    - apps/web/src/account/ProfileTab.tsx
    - apps/web/src/account/SessionsTab.tsx
    - apps/web/src/account/ApiKeysTab.tsx
    - apps/web/src/account/PricingTab.tsx
    - apps/web/src/account/PricingTab.test.tsx
    - apps/web/src/dashboard/DashboardGreeting.tsx
    - apps/web/src/dashboard/DashboardGreeting.test.tsx
    - apps/web/src/dashboard/DashboardSidebar.tsx
    - apps/web/src/dashboard/DashboardSidebar.test.tsx
    - apps/web/src/dashboard/CanvasGrid.tsx
    - apps/web/src/dashboard/CanvasGrid.test.tsx
    - apps/web/src/dashboard/useSortOrder.ts
    - apps/web/src/dashboard/useSortOrder.test.ts
  - Modified:
    - apps/web/src/styles.css
    - apps/web/src/landing/Navbar.tsx
    - apps/web/src/landing/Navbar.test.tsx
    - apps/web/src/landing/Footer.tsx
    - apps/web/src/landing/HomePage.tsx
    - apps/web/src/landing/AboutPage.tsx
    - apps/web/src/landing/PublicLayout.tsx
    - apps/web/src/landing/AppLayout.tsx
    - apps/web/src/dashboard/DashboardPage.tsx
    - apps/web/src/account/ProfilePage.tsx
    - apps/web/src/account/ProfilePage.test.tsx
    - apps/web/src/account/SessionsPage.tsx
    - apps/web/src/account/ApiKeysPage.tsx
    - apps/web/src/account/ApiKeyRow.tsx
    - apps/web/src/account/PatTokensSection.tsx
    - apps/web/src/auth/LoginPage.tsx
    - apps/web/src/auth/MagicLinkVerifyPage.tsx
    - apps/web/src/auth/InviteErrorPage.tsx
    - apps/web/src/agent/AiSidePanel.tsx
    - apps/web/src/agent/ChatComposer.tsx
    - apps/web/src/agent/ChatList.tsx
    - apps/web/src/canvas/Editor.tsx
    - apps/web/src/chrome/TopBar.tsx
    - apps/web/src/chrome/MainMenu.tsx
    - apps/web/src/components/UserAvatarMenu.tsx
    - apps/web/src/store/uiStore.ts
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
    - apps/web/src/router.tsx
    - apps/web/src/components/CanvasCard.tsx
    - apps/web/src/components/FolderTree.tsx
    - apps/web/src/account/ApiKeysPricingTable.tsx
  - Removed:
    - apps/web/src/account/ProfilePage 中的 locale select 欄位（不刪 file，只移除該段 JSX + 對應 zod 欄位）
    - 舊 `/account/profile` `/account/sessions` `/account/api-keys` 三個 route 的 createRoute 區塊（用 redirect-to-tab 取代）
