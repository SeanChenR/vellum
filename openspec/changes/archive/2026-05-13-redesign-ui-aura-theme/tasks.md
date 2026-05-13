## 1. Aura token map 進 styles.css（落實 spec theme-switching ADDED Requirement「Theme tokens are CSS custom properties switched by data-theme」）

- [x] 1.1 [P] 在 `apps/web/src/styles.css` `@theme inline` 之外新增 `:root, :root[data-theme="light"]` block 含 light 11 個 token（`--bg #FAF9F6` / `--surface #FFFFFF` / `--surface-elevated #F4F2EE` / `--border #E5E3DC` / `--text-primary #21202E` / `--text-muted #6B6976` / `--accent-purple #7C3AED` / `--accent-cyan #0D9488` / `--accent-pink #DB2777` / `--accent-orange #EA580C` / `--accent-red #DC2626`）+ `color-scheme: light`；以 `apps/web/src/styles.test.ts` 對 `getComputedStyle(document.documentElement)` 在 `data-theme="light"` 下斷言每個 token 解析為對應 hex。
- [x] 1.2 [P] 在同檔新增 `:root[data-theme="dark"]` block 含 dark 11 個 token（`--bg #21202E` / `--surface #2C2A3A` / `--surface-elevated #3D3B4D` / `--border #3D3B4D` / `--text-primary #EDECEE` / `--text-muted #A7A6B0` / `--accent-purple #A277FF` / `--accent-cyan #61FFCA` / `--accent-pink #FF6AD5` / `--accent-orange #FFCA85` / `--accent-red #FF6767`）+ `color-scheme: dark`；以同檔 test 在 `data-theme="dark"` 下斷言。
- [x] 1.3 在同檔擴充 `@theme inline` 把上述 11 個 token 暴露為 Tailwind utility name：`--color-bg: var(--bg)`、`--color-surface: var(--surface)`、`--color-surface-elevated`、`--color-border`、`--color-text-primary`、`--color-text-muted`、`--color-accent-purple`、`--color-accent-cyan`、`--color-accent-pink`、`--color-accent-orange`、`--color-accent-red`；以 `apps/web/src/styles-tailwind-tokens.test.ts` 渲染 `<div className="bg-bg text-text-primary border-border" />` 然後 assert `getComputedStyle` 算出對應 token 值。
- [x] 1.4 在同檔加 legacy alias block：`--color-ink-navy: var(--text-primary)` / `--color-warm-sepia: var(--text-muted)` / `--color-parchment-cream: var(--surface-elevated)` / `--color-off-white: var(--bg)`；附 comment 「removed after task 13.x grep verifies zero legacy class references」。

## 2. Theme bootstrap 在 React mount 前（落實 spec theme-switching ADDED Requirement「Document theme is applied before React mount」與 scenario「No theme flicker on cold load」）

- [x] 2.1 [P] 在 `apps/web/src/theme/bootstrap-theme.test.ts` 撰寫 RED 測試：`resolveInitialTheme({localStorage, matchMedia})` 純函式 — `vellum.theme="dark"` → 回 `dark`、`vellum.theme="light"` → 回 `light`、key 缺失且 `matches=true` → 回 `dark`、key 缺失且 `matches=false` → 回 `light`、key 缺失且 `matchMedia` 不存在 → 回 `light`（fallback）。
- [x] 2.2 在 `apps/web/src/theme/bootstrap-theme.ts` 實作 `resolveInitialTheme` + `applyInitialTheme()`（讀 `document.documentElement.setAttribute("data-theme", resolveInitialTheme(...))`），使 2.1 GREEN。
- [x] 2.3 在 `apps/web/src/main.tsx` import `bootstrap-theme` 並在 `createRoot` 呼叫前同步呼叫 `applyInitialTheme()`；以 `apps/web/src/main.test.ts` 斷言 main.tsx source 第一段 statement 是 `applyInitialTheme()` 呼叫。

## 3. useTheme hook + ThemeProvider（落實 spec theme-switching ADDED Requirement「System-aware theme mode with persisted user preference」與 scenarios「System mode reacts to OS preference change」「Explicit mode ignores OS preference change」）

- [x] 3.1 重命名 `apps/web/src/store/uiStore.ts` 內 `theme: Theme` → `themeMode: ThemeMode`（`"system"|"light"|"dark"`，預設 `"system"`），rename setter 並加 `localStorage` persist：set 時若 mode === "system" 則 `removeItem("vellum.theme")`，否則 `setItem("vellum.theme", mode)`；以 `apps/web/src/store/uiStore.test.ts` 對應斷言。
- [x] 3.2 [P] 在 `apps/web/src/theme/useTheme.test.ts` 撰寫 RED 測試：`useTheme()` 回 `{themeMode, effectiveTheme, cycleTheme}`；mode === "system" + matchMedia matches → effective 為 dark；matchMedia change 事件觸發 effective 更新；mode === "light" 時 matchMedia change 不影響 effective；`cycleTheme()` 走 system → light → dark → system 循環。
- [x] 3.3 在 `apps/web/src/theme/useTheme.ts` 實作 `useTheme()` hook（訂閱 uiStore + window.matchMedia + useEffect attach/cleanup listener），使 3.2 GREEN。
- [x] 3.4 [P] 在 `apps/web/src/theme/theme-provider.test.tsx` 撰寫 RED 測試：`<ThemeProvider>` 渲染後 `document.documentElement.dataset.theme` 對應 effective；切換 mode 時 attribute 同步變化。
- [x] 3.5 在 `apps/web/src/theme/theme-provider.tsx` 實作 `ThemeProvider` 元件（包裝 children，掛 useEffect 同步 `data-theme` attribute），使 3.4 GREEN；在 `apps/web/src/router.tsx` 的 rootRoute component 內掛 `<ThemeProvider>`。

## 4. ThemeToggle 與 LocaleToggle 元件（落實 spec theme-switching ADDED Requirement「Theme toggle is reachable from the navbar」與 spec locale-switching ADDED Requirements「Locale toggle in the navbar switches the active i18n language」「Locale preference is persisted server-side when signed in」）

- [x] 4.1 [P] 在 `apps/web/src/theme/ThemeToggle.test.tsx` 撰寫 RED 測試：render 後 button 含 lucide Sun/Moon/Monitor icon 對應當前 mode；click 三次後 mode 依序變 light → dark → system；`aria-label` 反映當前 mode 並使用 i18n key `nav.theme.toggleAriaLabel`。
- [x] 4.2 在 `apps/web/src/theme/ThemeToggle.tsx` 實作 ThemeToggle（用 `useTheme().cycleTheme` + lucide icons），使 4.1 GREEN。
- [x] 4.3 [P] 在 `apps/web/src/i18n/LocaleToggle.test.tsx` 撰寫 RED 測試：render zh-TW 時顯示「中」；click 後 `i18n.language === "en"` + label 變「EN」+ 已登入用 fetch mock 驗 `PATCH /api/account/me` body `{locale:"en"}`；未登入時不發 PATCH；PATCH 500 時 i18n 仍切換 + 顯示 `nav.locale.serverPatchFailed` toast。
- [x] 4.4 在 `apps/web/src/i18n/LocaleToggle.tsx` 實作 LocaleToggle（讀 `useAuth().isAuthenticated`、`useTranslation().i18n`），使 4.3 GREEN。

## 5. 4 個 UI primitive 元件（落實 spec public-pages MODIFIED Requirement「HomePage feature cards use the elevated Card primitive」與 spec account MODIFIED Requirements 共用 Card / Button / Input / Badge）

- [x] 5.1 [P] 在 `apps/web/src/components/ui/Card.test.tsx` 撰寫 RED 測試：`<Card>` 四個 variant（default / elevated / outlined / hover-ring）渲染對應 class；hover-ring variant 在 hover 時有 ring class；data-theme="dark" 下 background 解析 `--surface-elevated` 對應深色值。
- [x] 5.2 在 `apps/web/src/components/ui/Card.tsx` 實作 Card primitive（接 variant prop、HTMLDivElement props、forwardRef 不需要），使 5.1 GREEN。
- [x] 5.3 [P] 在 `apps/web/src/components/ui/Button.test.tsx` 撰寫 RED 測試：4 個 variant（primary / secondary / ghost / destructive）× 3 個 size（sm / md / lg）渲染對應 class；forwardRef ref 可拿；`onClick` 行為；disabled state 套對應 opacity class。
- [x] 5.4 在 `apps/web/src/components/ui/Button.tsx` 實作 Button primitive（forwardRef、variant+size discriminator），使 5.3 GREEN。
- [x] 5.5 [P] 在 `apps/web/src/components/ui/Input.test.tsx` 撰寫 RED 測試：`<Input label="email" />` 渲染 label + input；error prop 顯示 accent-red 訊息；icon prop 渲染左側 lucide icon + input left padding 38px；focus 時 ring 套 accent-purple。
- [x] 5.6 在 `apps/web/src/components/ui/Input.tsx` 實作 Input primitive，使 5.5 GREEN。
- [x] 5.7 [P] 在 `apps/web/src/components/ui/Badge.test.tsx` 撰寫 RED 測試：tone（cyan / purple / orange / muted）四個 variant 套對應 background + color；dot prop 渲染小圓點。
- [x] 5.8 在 `apps/web/src/components/ui/Badge.tsx` 實作 Badge primitive，使 5.7 GREEN。

## 6. NavBar 三欄 grid + 控制元件整合（落實 spec public-pages MODIFIED Requirement「NavBar uses a three-region grid with brand, primary nav, and chrome controls」與 scenarios「NavBar regions render in the correct order」「Active route link is visually distinguished」）

- [x] 6.1 在 `apps/web/src/landing/Navbar.test.tsx` 改既有 test：assert DOM order 為 brand → nav.links → LocaleToggle → ThemeToggle → AuthAction；assert grid template columns 為 `1fr auto 1fr`；assert active-route link 含 accent-purple underline class；assert loading auth 狀態下 placeholder width 與 avatar menu 一致（測 `data-testid="navbar-auth-placeholder"` 寬度）。
- [x] 6.2 在 `apps/web/src/landing/Navbar.tsx` rewrite layout：外層 `<div class="grid grid-cols-[1fr_auto_1fr]">`、左 brand、中 nav links（含 active route underline 邏輯，用 `useLocation()` 或 `useRouterState()` 拿當前 pathname）、右 group 含 `<LocaleToggle />` + `<ThemeToggle />` + `<AuthAction />`，使 6.1 GREEN；移除舊「max-w-6xl + flex justify-between」結構。
- [x] 6.3 [P] 在 `packages/shared/src/locales/zh-TW.json` + `packages/shared/src/locales/en.json` 加 keys：`nav.theme.toggleAriaLabel`、`nav.theme.system`、`nav.theme.light`、`nav.theme.dark`、`nav.locale.toggleAriaLabel`、`nav.locale.serverPatchFailed`、`nav.locale.zh-TW`、`nav.locale.en`；以 `apps/web/src/i18n-audit.test.ts` 對應 pass。

## 7. PublicLayout / AppLayout 統一容器寬（落實 spec public-pages MODIFIED Requirement「All non-canvas pages share the same outer container width」與 scenarios「HomePage, AboutPage, DashboardPage share container width」「AboutPage body prose remains narrow within wide container」）

- [x] 7.1 [P] 在 `apps/web/src/landing/PublicLayout.tsx` 確認外層只用 token 化 `bg-bg text-text-primary`，主 content slot 不再限 width（讓 page 自己用 `<div className="mx-auto max-w-6xl px-6 md:px-8">` 控制）；以 `apps/web/src/landing/PublicLayout.test.tsx` 對應 assertion 驗 wrapper class。
- [x] 7.2 [P] 在 `apps/web/src/landing/AppLayout.tsx` 同上重構，使 layout shell 不限 width；以 AppLayout.test.tsx 驗。
- [x] 7.3 在 `apps/web/src/landing/HomePage.tsx` 改三個 section 外層為 `mx-auto max-w-6xl px-6 md:px-8`，feature cards 用 `<Card variant="elevated">` 並 wrap `<Link>` 或 `<a>` 帶 hover-ring；以 `apps/web/src/landing/HomePage.test.tsx` 對應驗：feature cards 數量 = 3 + variant=elevated class 存在 + hover-ring 套上。
- [x] 7.4 在 `apps/web/src/landing/AboutPage.tsx` 改外層為 `mx-auto max-w-6xl px-6 md:px-8`，內層 prose 包一個 `<div className="max-w-prose mx-auto">`；以 AboutPage.test.tsx 對應驗 outer max-w-6xl + inner max-w-prose 並存。
- [x] 7.5 在 `apps/web/src/landing/Footer.tsx` 改外層為 `mx-auto max-w-6xl px-6 md:px-8`，所有 text/border 改 token 化（`text-text-muted` / `border-border` / hover `text-accent-purple`）；以 Footer.test.tsx 驗。

## 8. Dashboard 容器寬 + canvas grid card lift（落實 spec public-pages MODIFIED Requirement「All non-canvas pages share the same outer container width」+ design Decision 5「Component primitives 手寫 4 個」）

- [x] 8.1 在 `apps/web/src/dashboard/DashboardPage.tsx` 改外層為 `mx-auto max-w-6xl px-6 md:px-8`（已是 max-w-6xl，補上 token color + md:px-8）；canvas 卡片 grid 改用 `<Card>` primitive + 自帶 hover-lift class `hover:-translate-y-0.5 hover:shadow-md transition-transform duration-150`；以 `apps/web/src/dashboard/DashboardPage.test.tsx` 對應驗 Card primitive 用 + hover transform class 存在。

## 9. Account 三個 page 升級為 card layout（落實 spec account MODIFIED Requirements「ProfilePage renders the form inside an elevated card and omits the locale field」「SessionsPage renders each session as a card row with current-session badge」「ApiKeysPage groups BYOK providers and MCP tokens into two card sections」）

- [x] 9.1 [P] 在 `apps/web/src/account/ProfilePage.test.tsx` 改既有 test：移除 locale field assertion（getByLabelText "localeLabel" → 不存在）；assert form 在 `<Card variant="elevated">` 內；assert form submit body 僅含 `{name, image}`。
- [x] 9.2 在 `apps/web/src/account/ProfilePage.tsx` 重構：用 `<Card variant="elevated">` wrap form；移除 locale `<select>` + `profileFormSchema` 的 `locale` 欄位 + mutation payload 的 `locale`；i18n keys `account.profile.locale*` 不刪（避免 i18n-audit 假陽性，加 comment 標 deprecated），使 9.1 GREEN。
- [x] 9.3 [P] 在 `apps/web/src/account/SessionsPage.test.tsx` 加 RED 測試：當前 session 渲染 `<Badge tone="cyan">` 帶 i18n `account.sessions.thisDeviceBadge` 文字 + 排第一 row + 無 Revoke 按鈕；非當前 session 有 Revoke 按鈕；click Revoke 開 confirm dialog 後才送 DELETE。
- [x] 9.4 在 `apps/web/src/account/SessionsPage.tsx` 改 rendering：parent `<Card>` 包列表，每個 session row 用 `<Card variant="outlined">`，當前 session 用 Badge primitive；補 `account.sessions.thisDeviceBadge` i18n keys（zh-TW + en），使 9.3 GREEN。
- [x] 9.5 [P] 在 `apps/web/src/account/ApiKeysPage.test.tsx` 加 RED 測試：page 渲染後 DOM 同時含「Provider Keys 區段（含 anthropic / openai / google 三 row）」與「MCP Tokens 區段（PatTokensSection）」；Provider Keys 三 row 各用 Card primitive；兩 section 之間有 32px gap。
- [x] 9.6 在 `apps/web/src/account/ApiKeysPage.tsx` + `apps/web/src/account/ApiKeyRow.tsx` 重構：ApiKeysPage 外層 `max-w-6xl`，兩 section 各包 `<Card>` 或 wrapper div with `space-y-8`；ApiKeyRow 改用 Card primitive + Button primitive；使 9.5 GREEN。
- [x] 9.7 在 `apps/web/src/account/PatTokensSection.tsx` 改用 Card / Button / Badge / Input primitives；create-token dialog 內 plaintext 區塊背景改 `bg-accent-cyan-soft`；warning 用 `account.pat.plaintextWarning` 既有 key；以 `apps/web/src/account/PatTokensSection.test.tsx` 對應驗 plaintext 區塊 className 含 accent-cyan-soft + warning text 從 i18n。

## 10. Auth 三 page 升級（落實 spec auth MODIFIED Requirement「Authentication pages render centered card layouts using shared primitives」與全部 4 個 scenarios）

- [x] 10.1 [P] 在 `apps/web/src/auth/LoginPage.test.tsx` 加 RED 測試：page 只渲染一個 max-width 420px 的 `<Card variant="elevated">`；含 magic-link email input + 「or」divider + 「Sign in with Google」button；email submit 用 `<Button variant="primary">`。
- [x] 10.2 在 `apps/web/src/auth/LoginPage.tsx` 重構：用 Card primitive + Button primitive + Input primitive，divider 渲染為兩條 `<hr>` 夾「or」字（i18n key `auth.login.orDivider`），使 10.1 GREEN。
- [x] 10.3 [P] 在 `apps/web/src/auth/MagicLinkVerifyPage.test.tsx` 加 RED 測試：page 含一個 elevated Card + lucide Mail icon size=32 顏色為 accent-purple；icon 在 status copy 上方。
- [x] 10.4 在 `apps/web/src/auth/MagicLinkVerifyPage.tsx` 重構，使 10.3 GREEN。
- [x] 10.5 [P] 在 `apps/web/src/auth/InviteErrorPage.test.tsx` 加 RED 測試：page 渲染 elevated Card + warning icon 顏色 accent-orange + 標題 accent-orange + body text-muted。
- [x] 10.6 在 `apps/web/src/auth/InviteErrorPage.tsx` 重構，使 10.5 GREEN。

## 11. 暗色適配 canvas chrome + AI Side Panel（落實 design Decision 8「暗色模式下 Canvas editor 內元素的處理」與 spec motion-system MODIFIED Requirement「Theme switching is instant」）

- [x] 11.1 在 `apps/web/src/chrome/TopBar.tsx` 把所有 `bg-off-white` / `text-ink-navy` / `border-ink-navy/*` / `text-warm-sepia` 等改成 token 化（`bg-bg` / `text-text-primary` / `border-border` / `text-text-muted`）；以 `apps/web/src/chrome/TopBar.test.tsx` 對應 className assertion 更新。
- [x] 11.2 在 `apps/web/src/chrome/MainMenu.tsx` 同上 token 化，並驗 MainMenu.test.tsx。
- [x] 11.3 在 `apps/web/src/agent/AiSidePanel.tsx` token 化 backdrop / panel border；以 `apps/web/src/agent/AiSidePanel.test.tsx` 對應驗。
- [x] 11.4 在 `apps/web/src/agent/ChatComposer.tsx` + `apps/web/src/agent/ChatList.tsx` token 化所有顏色（textarea background 改 `bg-surface-elevated` / chat bubble 用 token）；以對應 .test.tsx 驗。
- [x] 11.5 在 `apps/web/src/canvas/Editor.tsx` 外層 wrapper div 改 `bg-bg`；不傳 dark theme prop 給 tldraw（保留 light canvas，per design Decision 8）；以 Editor.test.tsx 驗 wrapper class。
- [x] 11.6 [P] 在 `apps/web/src/styles.css` 確認 `:root` 沒有 `transition: background-color` 或類似 root-level transition；以 `apps/web/src/theme/theme-instant-switch.test.ts` 對 `<html>` computed style assert `transition-duration` 不包含 `background-color`。

## 12. Card hover-ring 動畫 + 減動效尊重（落實 spec motion-system MODIFIED Requirement「Card hover-ring transition is bounded and respects reduced-motion」與 scenarios）

- [x] 12.1 [P] 在 `apps/web/src/components/ui/Card.motion.test.tsx` 加 RED 測試：hover-ring variant 預設帶 `transition-shadow duration-150`；`prefers-reduced-motion: reduce` 時 computed transition-duration 為 `0s`（用 `matchMedia` mock）。
- [x] 12.2 在 `apps/web/src/components/ui/Card.tsx` 補 hover-ring class `transition-shadow duration-150`，並在 `apps/web/src/styles.css` 加 `@media (prefers-reduced-motion: reduce) { .v-card-hover-ring { transition-duration: 0s !important; } }`（class name 命用 vellum 命名），使 12.1 GREEN。

## 13. Legacy token cleanup + quality gates（落實 spec public-pages MODIFIED Requirement「Public pages consume the Aura token palette via CSS variables」scenario「Grep finds no legacy token usage in public-page components after archive」）

- [x] 13.1 [P] 在 `apps/web/src/landing` / `apps/web/src/dashboard` / `apps/web/src/account` / `apps/web/src/auth` / `apps/web/src/chrome` / `apps/web/src/agent` 內 grep `ink-navy|warm-sepia|parchment-cream|off-white` Tailwind className 並全部替換為對應 token utility；以 `apps/web/src/__audits__/no-legacy-tokens.test.ts` 用 fs + glob 掃描這六個目錄的 `.tsx` 檔斷言 0 個 legacy token className 匹配。
- [x] 13.2 在 `apps/web/src/styles.css` 移除 task 1.4 加的 legacy alias block（task 13.1 通過後）；以 `apps/web/src/styles-tailwind-tokens.test.ts` 確認 `bg-ink-navy` / `text-warm-sepia` 等 utility 不再產生效果（嘗試 className 後 computed style 等於 default not the alias）。
- [x] 13.3 [P] 跑 `bun run typecheck` 全綠；新加 `apps/web/src/theme/` + `apps/web/src/i18n/LocaleToggle*` + `apps/web/src/components/ui/` 四個目錄無 any、deps interface 顯式宣告。
- [x] 13.4 [P] 跑 `bunx oxlint apps/web/src/theme apps/web/src/i18n apps/web/src/components/ui apps/web/src/landing apps/web/src/account apps/web/src/auth apps/web/src/dashboard apps/web/src/chrome apps/web/src/agent` + `bunx oxfmt --check` 全綠。
- [x] 13.5 跑 `bun test --coverage`；apps/web/src/theme + apps/web/src/components/ui + apps/web/src/i18n/LocaleToggle.ts + 受影響的 landing/account/auth/dashboard 目錄 ≥ 70% lines / branches；補測 gap 至達標。
- [x] 13.6 跑 `bun run test:e2e -- smoke auth-magic-link canvas-crud`；既有 happy-path 三條 spec 不退步（auth + canvas list + share）。

## 14. Manual verification + 收尾

- [x] 14.1 Owner manual smoke：每個 route（`/`, `/about`, `/login`, `/auth/verify`, `/invite-error`, `/dashboard`, `/account/profile`, `/account/sessions`, `/account/api-keys`, `/canvas/<id>`）在 light + dark 各跑一次，視覺確認 — 對齊 `docs/design/aura-redesign/project/Vellum Redesign.html` 內對應 frame；確認語言切換在 navbar 與 server 同步，主題切換無 flicker、無 root-level transition。
- [x] 14.2 在 `docs/PHASE2_MILESTONES.md` 新增 「Post-Phase-2 polish」段落紀錄此 redesign 完成（或視 milestone naming 自行決定段落標題），含版號 v0.7.0 對應。
- [x] 14.3 Bump `packages/shared/src/index.ts` 的 `VELLUM_VERSION` 從 `0.6.0` → `0.7.0`，並同步 root + workspaces `package.json` 版號；以 `apps/web/src/landing/Footer.test.tsx` 對應更新。

## Traceability — Requirements → Tasks

| Spec | Requirement title | Task group |
|---|---|---|
| theme-switching | System-aware theme mode with persisted user preference | 3 |
| theme-switching | Document theme is applied before React mount | 2 |
| theme-switching | Theme tokens are CSS custom properties switched by data-theme | 1 |
| theme-switching | Theme toggle is reachable from the navbar | 4.1–4.2, 6 |
| locale-switching | Locale toggle in the navbar switches the active i18n language | 4.3–4.4 |
| locale-switching | Locale preference is persisted server-side when signed in | 4.3–4.4 |
| locale-switching | Locale toggle replaces the ProfilePage locale field | 9.1–9.2 |
| public-pages | Navbar exposes product identity and primary navigation | 6 |
| public-pages | All non-canvas pages share the same outer container width | 7, 8 |
| public-pages | Footer surfaces version and a single attribution row | 7.5 |
| public-pages | HomePage feature cards use the elevated Card primitive | 7.3 |
| public-pages | Public pages consume the Aura token palette via CSS variables | 11, 13 |
| account | ProfilePage renders the form inside an elevated card | 9.1–9.2 |
| account | SessionsPage renders each session as a card row with current-session badge | 9.3–9.4 |
| account | ApiKeysPage groups BYOK providers and MCP tokens into two card sections | 9.5–9.7 |
| account | Update profile | 9.1–9.2 |
| auth | Authentication pages render centered card layouts using shared primitives | 10 |
| motion-system | Card hover-ring transition is bounded and respects reduced-motion | 12 |
| motion-system | Theme switching is instant with no animation | 11.6 |

## Traceability — Design decisions → Tasks

| Decision | Task group |
|---|---|
| 1. CSS Custom Properties + `@theme inline` over Tailwind dark variant | 1 |
| 2. ThemeProvider applies before React mount | 2, 3.5 |
| 3. Three-mode theme with separate stored preference | 3.1–3.3 |
| 4. LocaleToggle is two-state, no dropdown | 4.3–4.4 |
| 5. Hand-written component primitives instead of shadcn CLI | 5 |
| 6. ProfilePage locale removal requires no schema migration | 9.1–9.2 |
| 7. Card hover ring only on interactive variant | 5.1–5.2, 12 |
| 8. Canvas chrome adapts to theme; tldraw interior stays light | 11 |
| 9. Dashboard two-column with greeting + sidebar + canvas grid | 19 |
| 10. Account three routes consolidated under `/account` tab page | 15, 16, 20 |
| 11. BYOK pricing as provider-grouped tier cards (no table) | 17 |
| 12. API & MCP row-based layout with saved-state badge | 18 |

---

## Ingest 2026-05-13 — Dashboard redesign + Account tab consolidation

First-pass implementation token-ified existing surfaces but did not restructure Dashboard / Account to match the Claude Design frames. This block adds the missing structural work while preserving every completed task above.

## 15. Account `/account` tab page shell（落實 spec account ADDED Requirement「Account settings live under a single tabbed route」）

- [x] 15.1 [P] 在 `apps/web/src/account/Tabs.test.tsx` 撰寫 RED 測試：`<Tabs items={[{id, label}]} activeId onChange />` 渲染 `role="tablist"` + 每個 `role="tab"` 含 `aria-selected` + `aria-controls`；click 任一 tab 觸發 `onChange(id)`；active tab class 含 accent-purple underline。落實 spec scenario「Clicking a tab updates the URL and active panel」accessibility 面。
- [x] 15.2 在 `apps/web/src/account/Tabs.tsx` 實作 Tabs primitive — 接 `items: {id, label}[]` / `activeId` / `onChange` props，inner button list 用 `flex border-b border-border` 排列，active tab 用 `border-b-2 border-accent-purple text-text-primary`，非 active 用 `text-text-muted hover:text-text-primary`；使 15.1 GREEN。
- [x] 15.3 [P] 在 `apps/web/src/account/AccountPage.test.tsx` 撰寫 RED 測試：render 後 URL `/account` 預設顯示 profile panel + 其它三 panel 不渲染（或 hidden）；click 「API 與 MCP」tab 後 URL 變 `/account?tab=api-keys` + ApiKeysTab 顯示；URL 直接打 `/account?tab=pricing` 也 deep-link 對。落實 spec scenarios「Default tab is profile」「Clicking a tab updates the URL and active panel」。
- [x] 15.4 在 `apps/web/src/account/AccountPage.tsx` 實作 shell：`<div className="mx-auto max-w-6xl px-6 py-10 md:px-8">` + heading + `<Tabs>` + `useSearch` 同步 URL ?tab=；mount 四個 panel 元件，依 activeId conditionally render；使 15.3 GREEN。
- [x] 15.5 在 `apps/web/src/router.tsx` 新增 `/account` route，component=AccountPage；既有 `/account/profile`、`/account/sessions`、`/account/api-keys` 三個 route 的 component 改成 redirect 元件（呼叫 `useNavigate({to: "/account", search: {tab: <id>}, replace: true})`）；以 `apps/web/src/router.test.tsx` 對應驗 redirect 行為。

## 16. ProfileTab / SessionsTab / ApiKeysTab 元件拆分（落實 spec account ADDED Requirement「Account settings live under a single tabbed route」內容拆分）

- [x] 16.1 在 `apps/web/src/account/ProfileTab.tsx` 把 `ProfilePage.tsx` 內 form + Card 結構抽出（移除 outer `<main className="...">` shell + heading；保留 form 邏輯不動）；以 `apps/web/src/account/ProfileTab.test.tsx` 對應驗：渲染 form + Card variant=elevated + 含 name/image input。
- [x] 16.2 在 `apps/web/src/account/SessionsTab.tsx` 把 `SessionsPage.tsx` 內 sessions list + confirm dialog 抽出（移除 outer shell）；以 `apps/web/src/account/SessionsTab.test.tsx` 驗：當前 session 排第一 + cyan badge + 非當前 row 有 Revoke 按鈕。
- [x] 16.3 在 `apps/web/src/account/ApiKeysTab.tsx` 把 `ApiKeysPage.tsx` 內 BYOK section + PAT section 抽出，**移除既有 pricing table 區塊**（移到 PricingTab）；以 `apps/web/src/account/ApiKeysTab.test.tsx` 驗：DOM 同時含 provider rows + MCP tokens section + 不含 pricing 表格。
- [x] 16.4 把原 `ProfilePage.tsx` / `SessionsPage.tsx` / `ApiKeysPage.tsx` 三個 file 改成單行 wrapper（`export const ProfilePage = ProfileTab` 等）保留 import compatibility；或直接刪除 file 並把 router 改成 redirect 元件（依 15.5 決定）；以 typecheck 驗無 broken import。

## 17. PricingTab — BYOK pricing 卡片化（落實 spec account ADDED Requirement「Pricing tab renders BYOK pricing as provider-grouped tier cards」）

- [x] 17.1 [P] 在 `apps/web/src/account/PricingTab.test.tsx` 撰寫 RED 測試：render 後三個 `<Card variant="elevated">` 對應 Anthropic / OpenAI / Google；每 Card 含三 row（flagship / balanced / economy）；flagship row 含 `<Badge tone="purple">`、balanced=cyan、economy=muted；model ID 用 `font-mono` class；input + output 價錢字串對齊 `BYOK_PRICING` 來源。
- [x] 17.2 在 `apps/web/src/account/PricingTab.tsx` 實作：`import { BYOK_PRICING } from "@vellum/shared/byok-pricing"`、`groupBy provider` → 三 Card grid (`md:grid-cols-3`)、每 row 用 `flex justify-between` + Badge + font-mono modelId + 價錢區 `${input} / ${output} USD`；使 17.1 GREEN；page 內不含 `<table>` 元素。
- [x] 17.3 [P] 在 `packages/shared/src/locales/zh-TW.json` + `packages/shared/src/locales/en.json` 加 keys：`account.pricing.title` / `account.pricing.subtitle` / `account.pricing.tier.flagship` / `account.pricing.tier.balanced` / `account.pricing.tier.economy` / `account.pricing.inputLabel` / `account.pricing.outputLabel` / `account.pricing.unit`（`USD / 1M tokens`）；以 i18n-audit 對應 pass。

## 18. API 與 MCP rows 改 row-based 排版（落實 spec account ADDED Requirement「API & MCP tab uses row-based layout with saved-state indicator」）

- [x] 18.1 [P] 在 `apps/web/src/account/ApiKeyRow.test.tsx` 加 RED 測試：saved 狀態渲染 `<Badge tone="cyan" dot>` 帶 i18n key `account.apiKeys.savedBadge` 文字；非 saved 狀態無此 badge；replace / delete 按鈕 inline 不換行。
- [x] 18.2 在 `apps/web/src/account/ApiKeyRow.tsx` 改 rendering：`flex items-center justify-between gap-4` 一行排版（left: provider name + lucide icon + saved badge if saved; middle: masked key font-mono; right: replace + delete buttons inline）；移除外層 Card border-radius（讓 ApiKeysTab 用 single Card with `divide-y` 包）；使 18.1 GREEN。
- [x] 18.3 在 `apps/web/src/account/ApiKeysTab.tsx` 外層 single `<Card>` + 內 `<div className="divide-y divide-border">` 包三個 ApiKeyRow；移除原本三個 Card per provider 的結構。
- [x] 18.4 [P] 在 `apps/web/src/account/PatTokensSection.test.tsx` 加 RED 測試：每個 PAT 渲染 lucide `Key` icon + name (semibold) + masked prefix (font-mono) + last-used + expires + Revoke ghost button 在同一 flex row 上；create-token dialog plaintext 區塊 className 含 `bg-accent-cyan/10` + lucide `Copy` icon 在 copy button 內。
- [x] 18.5 在 `apps/web/src/account/PatTokensSection.tsx` 改 token row 排版為 `flex items-center justify-between` + lucide Key icon；create-token dialog plaintext box 從 `bg-accent-cyan/10` 改正式套上 + copy button 加 lucide `Copy` icon；使 18.4 GREEN。
- [x] 18.6 [P] 在 `packages/shared/src/locales/zh-TW.json` + `packages/shared/src/locales/en.json` 加 keys：`account.apiKeys.savedBadge`（「已連線」/「Connected」）；以 i18n-audit pass。

## 19. Dashboard 兩欄結構 + greeting + 搜尋 + sort（落實 spec public-pages ADDED Requirement「DashboardPage uses a two-column layout with greeting strip, sidebar, and canvas grid」與五個 scenarios）

- [x] 19.1 [P] 在 `apps/web/src/dashboard/useSortOrder.test.ts` 撰寫 RED 測試：`useSortOrder()` 回 `{order, setOrder}`；預設 `"recent"`；setOrder("alphabetical") 寫入 `localStorage["vellum.dashboard.sortOrder"]`；mount 時讀 localStorage 還原；invalid value fallback 到 "recent"。落實 spec scenario「Sort order persists across page reload」。
- [x] 19.2 在 `apps/web/src/dashboard/useSortOrder.ts` 實作 hook，使 19.1 GREEN。
- [x] 19.3 [P] 在 `apps/web/src/dashboard/DashboardGreeting.test.tsx` 撰寫 RED 測試：render 後含今日日期（用 `Intl.DateTimeFormat` 在 zh-TW locale）+ 歡迎詞含 user.name + Input with lucide Search icon + 主 CTA 含 lucide Plus + "新畫布" 文字；search input onChange 觸發 onSearchChange prop。落實 spec scenario「Greeting strip exposes search, primary CTA, and welcome line」。
- [x] 19.4 在 `apps/web/src/dashboard/DashboardGreeting.tsx` 實作 element：fix props `{userName, searchQuery, onSearchChange, onCreateClick}`；使 19.3 GREEN。
- [x] 19.5 [P] 在 `apps/web/src/dashboard/DashboardSidebar.test.tsx` 撰寫 RED 測試：渲染 FolderTree 垂直 stack；active folder row 含 `bg-accent-purple/10` + `text-accent-purple`；tag chips 用 Badge primitive；sort buttons 兩個 ghost button（最近編輯 / 字母排序），active button 有 `text-text-primary` 非 active 有 `text-text-muted`。落實 spec scenario「Sidebar folder active state uses accent-purple-soft」。
- [x] 19.6 在 `apps/web/src/dashboard/DashboardSidebar.tsx` 實作 — 包 FolderTree 改為垂直 stack 模式 + Badge tag chips + sort buttons；FolderTree 內部 DnD logic 不動；使 19.5 GREEN。
- [x] 19.7 [P] 在 `apps/web/src/dashboard/CanvasGrid.test.tsx` 撰寫 RED 測試：吃 `canvases: Canvas[]` props 渲染 `<Card variant="hover-ring">` 網格；每 card 含 16:10 thumbnail + role badge + title + last-edited font-mono；empty list 渲染 empty state；alphabetical sort 把 canvases 依 title localeCompare 排序。
- [x] 19.8 在 `apps/web/src/dashboard/CanvasGrid.tsx` 實作；接 `canvases / searchQuery / sortOrder / onSelectCanvas` props；內部 useMemo filter+sort；使 19.7 GREEN。
- [x] 19.9 改 `apps/web/src/dashboard/DashboardPage.tsx`：頂端用 `<DashboardGreeting>` + 下方 `grid md:grid-cols-[220px_1fr]` 含 `<DashboardSidebar>` + `<CanvasGrid>`；搜尋狀態提升到 DashboardPage 用 useState 管；以 `apps/web/src/dashboard/DashboardPage.test.tsx` 更新對應 assertion：DOM 含 greeting + sidebar + grid 三區塊 + 無「升級 / Upgrade / Studio」字串。落實 spec scenarios「No subscription/upgrade callout is rendered」「Search filters the canvas grid in place」。
- [x] 19.10 [P] 在 `packages/shared/src/locales/zh-TW.json` + `packages/shared/src/locales/en.json` 加 keys：`dashboard.greeting.hello`（「早安，{{name}}」）/ `dashboard.searchPlaceholder` / `dashboard.newCanvasCta` / `dashboard.sort.recent` / `dashboard.sort.alphabetical`；以 i18n-audit pass。

## 20. Legacy route redirect + cleanup（落實 spec account ADDED Requirement「Account settings live under a single tabbed route」scenario「Legacy /account/profile redirects to tab」）

- [x] 20.1 在 `apps/web/src/account/legacy-redirects.tsx` 新增三個 redirect 元件（ProfileRouteRedirect / SessionsRouteRedirect / ApiKeysRouteRedirect），每個 mount 時呼叫 `useNavigate({to: "/account", search: {tab: <id>}, replace: true})`；以 `apps/web/src/account/legacy-redirects.test.tsx` 對應驗：mount ProfileRouteRedirect 後 navigate 被呼叫帶 tab=profile + replace=true。
- [x] 20.2 router.tsx 內 `/account/profile`、`/account/sessions`、`/account/api-keys` 三個 route component 改成對應 redirect 元件；保留 path 結構但 component 不再渲染原 page。
- [x] 20.3 把舊的 `apps/web/src/account/ProfilePage.tsx` / `SessionsPage.tsx` / `ApiKeysPage.tsx` 標記為 `@deprecated`（或直接刪掉只保留 tab 元件 — 由 16.4 決定）；確認沒有別處 import；以 typecheck 全綠驗。

## 21. LocaleToggle endpoint regression test（落實 design Decision 4 ingest fix path）

- [x] 21.1 確認 `apps/web/src/i18n/LocaleToggle.tsx` 內 PATCH endpoint 為 `/api/account/profile`，且 LocaleToggle.test.tsx 既有 assertion 已對齊（從先前 ingest 修復繼承）。
- [x] 21.2 在 `apps/web/src/i18n/LocaleToggle.test.tsx` 加 regression test：mock fetch 回 200 + 已登入 user → click → unmount + re-mount with same QueryClient → 斷言 `i18n.language` 維持為 next 且 `["auth", "session"]` cache 內 locale === next（驗 useAuth useEffect 不會 revert）。

## 22. Quality gates + manual smoke（補強）

- [x] 22.1 [P] 跑 `bun run typecheck` 全綠；新加 `apps/web/src/account/{Tabs,AccountPage,ProfileTab,SessionsTab,ApiKeysTab,PricingTab,legacy-redirects}.tsx` + `apps/web/src/dashboard/{DashboardGreeting,DashboardSidebar,CanvasGrid,useSortOrder}.{ts,tsx}` 兩個目錄無 any、deps interface 顯式宣告。
- [x] 22.2 [P] 跑 `bunx oxlint apps/web/src/account apps/web/src/dashboard` + `bunx oxfmt --check` 全綠。
- [x] 22.3 跑 `bun test apps/web/src/account apps/web/src/dashboard --coverage`；新加 file ≥ 70% lines；補測 gap 至達標。
- [x] 22.4 Owner manual smoke：(a) `/dashboard` 看到頂端 greeting + 左 sidebar folder + 右 canvas grid（無 Upgrade 卡）；切換 sort + 搜尋過濾即時 work；(b) `/account` 預設打開 profile tab；四個 tab 切換 URL 同步；(c) 舊 `/account/profile` URL redirect 到 `/account?tab=profile`；(d) PricingTab 三 card 對齊 BYOK_PRICING；(e) ApiKeysTab provider rows 在單一 Card 內含 cyan dot saved badge；(f) PAT row 為一行排版；(g) 切換 navbar locale 後切到別 route 不會 revert。
- [x] 22.5 在 `docs/PHASE2_MILESTONES.md` Post-Phase-2 polish 段落補一行紀錄 ingest 補強（Dashboard redesign + Account tab consolidation + Pricing tier cards）— 仍 v0.7.0 範圍，不 bump 版號。
