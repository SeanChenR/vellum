## Context

Vellum 已交付 Phase 1（畫布基底）+ Phase 2（AI co-pilot + MCP），現有 UI 由各 milestone 累加，配色、寬度、互動慣例不一致。Claude Design 完成 `docs/design/aura-redesign/` 高保真設計，含 9 個 route × 2 主題 mockup、tokens.css、component spec sheet。本 design 文件決定 token 系統、theme switching 機制、locale switching 機制、component primitives 抽取、現有 capability 的 visual 邊界，所以 implementation 可以照表操課。

**目前狀態（implementation 前）：**

- `apps/web/src/store/uiStore.ts` 已存在 `theme: "light" | "dark"` 但無實際應用；沒有 `data-theme` attribute、沒有 CSS variables、沒有 toggle UI。
- `apps/web/src/styles.css` 用 Tailwind v4 `@theme` 宣告四個品牌 token（`--color-ink-navy`、`--color-parchment-cream`、`--color-warm-sepia`、`--color-off-white`），都是亮色固定值。
- i18next 已掛在 `apps/web/src/i18n/index.ts`；切換方式只透過 ProfilePage 表單。
- 沒有 shared component primitives — 每個 page 重複寫 `rounded-lg border border-gray-200 p-4` 樣式。

**約束：**

- Tailwind v4，用 `@theme inline` 宣告，要兼容 oxlint + oxfmt
- React 19；motion 不換
- 不引入新 npm package（CSS custom properties 原生即可）
- i18n key 雙語同步（zh-TW + en）必須維持
- canvas editor 內 tldraw 渲染不改，只改外殼 chrome 跟 AI Side Panel

## Goals / Non-Goals

**Goals**

- 一份 single source of truth token map（light + dark），所有 component 都讀 CSS var
- Theme toggle = `system` / `light` / `dark` 三態，預設 `system`，使用者選擇持久化到 localStorage
- Theme 切換 zero flicker（首次 render 在 React mount 前就讀 localStorage + apply data-theme）
- Locale toggle = `中` / `EN`，已登入時同步 server
- 所有 non-canvas page 共用 `max-w-6xl` 容器
- NavBar 三欄 grid 含 locale + theme + auth 控制
- 抽出 `<Card>` / `<Button>` / `<Input>` / `<Badge>` 4 個 primitives 給後續用
- Card hover transition < 200ms；其餘無新動畫

**Non-Goals**

- 不做 tldraw 內部 shape / cursor / arrow 的 dark mode（tldraw 自帶 theming，留 follow-up）
- 不做 mobile responsive 重寫（hamburger collapse 列 P2，本次只確保 NavBar 在窄屏不破版）
- 不做 motion-system primitive 新增（只調 Card hover）
- 不改 i18n 既有 keys
- 不引入 shadcn CLI（手寫 4 個 primitives 即可，bundle 控制）

## Decisions

### 1. CSS Custom Properties + `@theme inline` 而非 Tailwind dark variant

**Decision**: 用 `:root[data-theme="dark"]` + CSS custom properties 切換值，Tailwind v4 `@theme inline { --color-surface: var(--surface); ... }` 把 var 包成 utility class。

**Why**: Tailwind v4 `dark:` 變體需要在每個 utility 雙寫 (`bg-white dark:bg-gray-900`)，重構成本高。CSS var 切換在 `<html>` 上一次完成、所有後代 inherit。Aura design bundle 也是這個寫法。

**How to apply**: `apps/web/src/styles.css` 內：

```css
:root,
:root[data-theme="light"] {
  --bg: #FAF9F6;
  --surface: #FFFFFF;
  /* ... 全部 11 個 light tokens */
}
:root[data-theme="dark"] {
  --bg: #21202E;
  /* ... 全部 11 個 dark tokens */
}
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-border: var(--border);
  --color-text-primary: var(--text-primary);
  --color-text-muted: var(--text-muted);
  --color-accent-purple: var(--accent-purple);
  --color-accent-cyan: var(--accent-cyan);
  --color-accent-pink: var(--accent-pink);
  --color-accent-orange: var(--accent-orange);
  --color-accent-red: var(--accent-red);
}
```

舊 token (`--color-ink-navy` 等) 保留為 alias 過渡期：`--color-ink-navy: var(--text-primary);` — implementation 期間 grep + 替換所有 `text-ink-navy` → `text-text-primary` 等 utility 後再清掉 alias。

### 2. ThemeProvider 在 React mount 前先 apply

**Decision**: `apps/web/src/main.tsx` 在 React `createRoot` 之前先讀 localStorage + 計算 effective theme + `document.documentElement.setAttribute("data-theme", effective)`。然後 `<ThemeProvider>` 接管後續更新。

**Why**: 避免「白底 → 暗底」閃爍。React render 第一張 frame 就有正確 data-theme。

**How to apply**: 新增 `apps/web/src/theme/bootstrap-theme.ts` 含 `applyInitialTheme()` 純函式（從 localStorage 讀 `vellum.theme` key、fallback `system`、解析 `prefers-color-scheme` matchMedia 同步呼叫拿值），在 `main.tsx` import 後第一個 statement 呼叫。

### 3. Theme 三態，使用者選擇分開儲存

**Decision**: Zustand store 改成 `themeMode: "system" | "light" | "dark"`（使用者選擇）+ `effectiveTheme: "light" | "dark"`（實際 apply）。前者持久化，後者 derived。

**Why**: 區分「使用者選 system」跟「使用者選 light」很重要——使用者改 OS 偏好時前者要跟著變，後者要忽略。

**How to apply**: `apps/web/src/store/uiStore.ts` 改名 `theme` → `themeMode`；`useTheme()` hook 訂閱 `themeMode` + `prefers-color-scheme` matchMedia 算出 effectiveTheme，且只在 `themeMode === "system"` 時聽 matchMedia change。

### 4. LocaleToggle = 兩態切換，無下拉

**Decision**: vellum 只支援 zh-TW + en 兩種 locale，icon button 直接 toggle 不展開選單。當前 `zh` 顯示「中」icon，點一下變「EN」並切換 i18n。

**Why**: 兩個選項用下拉是過度設計。直接 toggle 更快。

**How to apply**: `apps/web/src/i18n/LocaleToggle.tsx` 接 `i18n.language`，render lucide `Languages` + 當前 locale 標籤；點擊呼叫 `i18n.changeLanguage(next)` + 已登入時 `fetch("/api/account/profile", {method: "PATCH", body: {locale: next}})`（既有 endpoint，server 已接受 locale 欄位）。

**Implementation note (ingest fix)**: `useAuth` 對 `["auth", "session"]` query 有 60s staleTime + `useEffect` 依 `user.locale` 反向 sync 到 `i18n.changeLanguage`。沒 cache 更新就會在下次 route 變動讀回 stale locale 蓋掉使用者的選擇。LocaleToggle 必須在 PATCH 前先 `queryClient.setQueryData(["auth", "session"], prev => ({...prev, locale: next}))` 樂觀更新；PATCH 成功後 `invalidateQueries` 拉 server 真值；PATCH 失敗則保留樂觀值 + 顯示 aria-live 錯誤訊息，不 revert UI。

### 5. Component primitives 手寫 4 個，不裝 shadcn CLI

**Decision**: `apps/web/src/components/ui/{Card,Button,Input,Badge}.tsx` 手寫，class 完全用 token-based Tailwind utility，無 forwardRef bloat。Variants 用 props discriminator (`variant: "default" | "elevated" | "outlined"`) 內部用 `clsx`-style 字串拼接（沿用既有 vendor pattern，不裝 `clsx`）。

**Why**: bundle size + 編譯時間考量。shadcn CLI 會帶來大量 Radix dep；vellum 既有 a11y dialog 都自己寫，沒這需求。

**How to apply**: 每個 primitive 接受標準 HTML props (`React.HTMLAttributes<HTMLDivElement>` 等) + 自己的 variant + size props。Button 必須 forwardRef（form submit 可能要 ref），其它三個不必。

### 6. ProfilePage 移除 locale field 不需 migration

**Decision**: 後端 `users.locale` 欄位保留（其它地方還用，例如 email 模板選語言）；只移除前端 ProfilePage 的 locale select UI + 對應 zod validation。LocaleToggle 切換時直接 patch 同一 endpoint，後端契約不變。

**Why**: 後端 schema 不動，無 DB migration risk。前端只少了一個 UI 進入點，多了 navbar 的更直接的進入點。

**How to apply**: ProfilePage `profileFormSchema` 移除 `locale: z.enum(["zh-TW","en"]).optional()`；form jsx 移除整段 locale `<select>` 區塊；mutation `mutate({name, image, locale})` 改成 `mutate({name, image})`。i18n key `account.profile.localeLabel` 等不再使用但保留（避免 audit broken-link）。

### 7. Card hover ring 只給 hover 互動，不給 static accent

**Decision**: `<Card variant="hover-ring">` 才會在 hover 時加 2px accent-purple ring；`variant="default"` / `"elevated"` / `"outlined"` 均不主動 ring。HomePage feature card 用 `hover-ring`，account section card 用 `elevated`，dashboard canvas thumbnail 用 `default` + 自己的 hover lift。

**Why**: accent purple 是強指示色，用於 CTA / 焦點 / active link；不該變成 static decoration 通膨。

**How to apply**: Card primitive 接 `variant` prop，hover-ring 變體 class 加 `hover:ring-2 hover:ring-accent-purple transition-shadow duration-150`。

### 8. 暗色模式下 Canvas editor 內元素的處理

**Decision**: in-canvas TopBar / MainMenu / AI Side Panel / ChatComposer 全部讀 CSS var；tldraw 內部 shape 保留 light theme（tldraw 自家 dark theme integration 是另一個 milestone）。

**Why**: 使用者選暗色看到亮亮的 tldraw 畫布內部會違和，但比起 hack tldraw 內部 styling，更實用是「chrome 暗色 + 畫布亮色」對比，類似 IDE 的 light-editor + dark-chrome pattern。

**How to apply**: Editor.tsx 在 `<Tldraw>` 外的 wrapper div 用 `bg-bg`；in-canvas chrome 元件改讀 token；AiSidePanel 改讀 `bg-surface-elevated` 等 token。tldraw 本體不傳 dark theme prop。

### 9. Dashboard 結構：兩欄 grid，左 sidebar 右 canvas 網格（ingest 補強）

**Decision**: DashboardPage 改寫成兩個區塊：頂端 greeting 列（200px 高，含日期 + 歡迎詞 + 搜尋輸入 + 「新畫布」CTA），下方兩欄 grid `[220px · 1fr]`。左 sidebar 含資料夾列表（含 sentinel `全部畫布` / `共享` / `封存` + user folders）、tag chips、排序切換。右側為 canvas 卡片網格 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`。

**Why**: 現在 DashboardPage 把 FolderTree 渲染成橫向 pill strip 在頂端，搜尋功能不存在。Design 的兩欄結構更接近使用者期待的「資料夾選單在側邊、內容在主區」工具感。Search 是常用操作，放頂端 + 含 lucide `Search` icon。Sort 切換用 ghost button（最近編輯 / 字母排序），狀態用 `useSortOrder` hook 持久化到 localStorage。

**Why not "Upgrade to Studio" 升級卡**：vellum 沒有訂閱模式。Design 該位置改放 vellum 已交付的 Phase 完工度 badge（"Phase 2 完工 · v0.7"）或留白；本 change 採後者，留白給 sidebar 第三段（未來加 Quick Actions 用）。

**How to apply**: 拆出三個元件：
- `apps/web/src/dashboard/DashboardGreeting.tsx`：日期 + 歡迎詞 + `<Input icon={<Search />} />` + `<Button variant="primary" icon={<Plus />}>`，受控 search 狀態提升到 DashboardPage 透過 props 傳入。
- `apps/web/src/dashboard/DashboardSidebar.tsx`：包 `<FolderTree>` (改為垂直 stack 模式) + tag chips (Badge primitive) + sort buttons。
- `apps/web/src/dashboard/CanvasGrid.tsx`：純 presentational，吃 `canvases: Canvas[]` 渲染 CanvasCard 網格。

新 hook `useSortOrder()`：回 `{order: "recent" | "alphabetical", setOrder}`，state 持久化到 `localStorage["vellum.dashboard.sortOrder"]`，預設 `"recent"`。

Search filter 在 DashboardPage 內 useMemo 算（不開新 query）：對 ownedList.canvases 跑 `String.includes(searchQuery.toLowerCase())` on title。

### 10. Account 三條 route 合併成 `/account` tab page（ingest 補強）

**Decision**: 拆掉 `/account/profile` `/account/sessions` `/account/api-keys` 三個獨立 route，改成單一 `/account` route，內部用 `<Tabs>` 切換四個 panel：
1. `個人資料`（ProfileTab，原 ProfilePage 內容）
2. `登入裝置`（SessionsTab，原 SessionsPage）
3. `API 與 MCP`（ApiKeysTab，原 ApiKeysPage 拆出 BYOK + PAT，不含定價表）
4. `定價參考`（PricingTab，BYOK pricing 視覺化）

舊 route 設成 `redirect` 行為（`/account/profile` → `/account?tab=profile`），避免 share-link 失效。當前 active tab 由 URL search param `?tab=profile|sessions|api-keys|pricing` 控制，預設 `profile`。

**Why**: 三個獨立 route 重複的 NavbarTab 設計效率差。合併後 tab navigation 在頁面內，不重 fetch 不破 query cache，符合「設定中心」心智模型。「定價參考」放這層是因為 BYOK pricing 跟 API & MCP 同為帳號管理範疇，而非首頁 marketing 用途。

**How to apply**:
- 新增 `<Tabs>` primitive 在 `apps/web/src/account/Tabs.tsx`，輕量：用 `useState` 管 active tab + URL search param 同步、accessibility 含 `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`。
- AccountPage.tsx 是 shell：渲染 page heading + `<Tabs>` + 對應 panel component。
- 既有 ProfilePage / SessionsPage / ApiKeysPage 拆出 panel content 變成 ProfileTab / SessionsTab / ApiKeysTab，外殼 `mx-auto max-w-6xl px-6 md:px-8` 由 AccountPage 提供。
- router.tsx：保留 `/account/*` 三個 path，component 改成 redirect 到 `/account?tab=X`。新增 `/account` route。

### 11. BYOK 定價卡片化（ingest 補強）

**Decision**: 把既有 `ApiKeysPricingTable` 的 9 row × 6 column 表格改成三張 elevated card（一張 per provider：Anthropic / OpenAI / Google），每張 card 內 3 row（旗艦 / 平衡 / 經濟）。每 row 顯示：tier name (Badge purple/cyan/muted) + model ID (font-mono) + input price + output price (USD / 1M tokens)。價錢用 `font-mono` 對齊。

**Why**: 9 row 表格在 desktop 上感覺資料庫感重，且 user 提出「除了表格外可以想想怎麼呈現」。三 provider card 結構更接近 design 的卡片美學，也讓使用者更容易橫向比較同一 provider 不同 tier。資料源仍是 `BYOK_PRICING` 常量，不改 schema。

**How to apply**:
- 新增 `PricingTab.tsx` 渲染三 card grid (`md:grid-cols-3`)。
- 每 card header 顯示 provider name + lucide icon (Anthropic / OpenAI / Google sticker)。
- 每 tier row 用 `flex justify-between` 排版：tier badge + model ID + 價錢區。
- 舊 `ApiKeysPricingTable.tsx` 不刪（其它 page 可能引用），但 PricingTab 不 import 它。

### 12. API 與 MCP rows 改 design 風格（ingest 補強）

**Decision**: ApiKeysTab 內 BYOK rows 從「每 provider 一張 Card」改成「單一 elevated Card 容器 + 三個 row 用 divider 分」。Saved 狀態用 cyan dot badge `已連線`；replace / delete 用 ghost / destructive button inline；輸入框含 provider logo icon prefix。

PatTokensSection 內 PAT row 改成「name (semibold) + masked prefix (font-mono small) + last-used 相對時間 + expires + revoke ghost button」一 row 排版（之前是 stacked block）。Create dialog 內 plaintext reveal 區塊改用 `bg-accent-cyan/10` highlight + copy button 帶 lucide `Copy` icon。

**Why**: design 的 row-based 排版資訊密度更高，使用者一眼看到所有 provider 狀態。Card-per-provider 不必要佔太多垂直空間。

**How to apply**:
- `ApiKeyRow.tsx` 改：移除外層 Card border-radius；加 saved 狀態 cyan dot badge；inline 行動按鈕（不再單獨一行）。
- ApiKeysTab.tsx 用 `<Card>` 包整段，內部 rows 之間用 `divide-y divide-border`。
- `PatTokensSection.tsx` 內 token row 從 block stack 改成 `flex items-center justify-between`，含 lucide `Key` icon 在左。
- Create-token dialog 內 plaintext block 加 lucide `Copy` icon button 在右上。

## Risks & Trade-offs

- **Token rename 範圍大**：所有 `bg-off-white` / `text-ink-navy` / `text-warm-sepia` 都要改成 token-based。grep + replace + visual review。中間如有遺漏，視覺會崩。減緩：保留舊 token 為 alias，最後 PR 才清；每個檔案改完即時瀏覽器看一次。
- **Theme bootstrap flicker**：如果 `applyInitialTheme()` 沒在 React render 前跑，第一張 frame 會閃。減緩：寫 unit test 驗證 main.tsx 內 import 順序、加 e2e check 首次載入無 flicker（Playwright 截圖比對）。
- **Locale toggle 與 ProfilePage 並存期間**：如果 user 開兩個 tab，一個改 navbar locale、一個 ProfilePage 還有舊 locale field — 後者送出會覆蓋前者。減緩：直接移除 ProfilePage locale field，不留中間態。
- **暗色 + tldraw 亮色違和感**：列 Phase 3 follow-up，本次接受。
- **既有測試會壞**：`Navbar.test.tsx` 假設 `text-ink-navy` class，token rename 會壞。減緩：先改 component + 同步更測試，每個 component 走 TDD 不留 broken test。
- **Account 路徑改寫破舊 share-link**：第三方 doc / bookmark 指向 `/account/profile` 等舊 path 會 404。減緩：保留三條 route 但 component 改 redirect 到 `/account?tab=...`，URL 帶 search param。
- **Dashboard 從橫向 pill 改兩欄破 DnD**：既有 FolderTree 用 `@dnd-kit` 接收 canvas drop。改 sidebar 後 drop target 仍要 work。減緩：FolderTree 內 DnD logic 不動，只改外層排版 + active state styling；測試覆蓋 drop event 不退步。

## Scope

**In scope:**
- 11 個 CSS token light + dark
- 6 個 capability spec delta（public-pages / account / auth / motion-system / theme-switching / locale-switching）
- 9 個 route 改版視覺 + 1 個新 component primitive 群
- 4 個 component primitives + 2 個 NavBar 控制元件 + 1 個 ThemeProvider
- ProfilePage locale field 移除
- Dashboard 重做兩欄結構含 greeting + search + sort + folder/tag sidebar（不做 Studio 升級 callout）
- Account 三條 route 合併成 `/account` tab page，新加「定價參考」tab
- BYOK pricing 從表格改 provider-grouped tier cards
- API 與 MCP rows 改 row-based 排版 + saved 狀態 cyan dot badge
- 所有受影響 component 測試同步更新

**Out of scope:**
- tldraw 內部渲染主題
- Mobile responsive 重寫（hamburger collapse、drawer 等留 P2）
- Email 模板配色（後端 React Email 模板獨立 rendering，本次不動）
- 新 motion primitives
- Storybook / Chromatic visual regression infra（沒裝過、不要這次加）
- bundle size 規範（這次不改 bundle 上限規則）
- 訂閱 / Studio 升級流程（vellum 沒有訂閱模式）
- Canvas 編輯器內部 shape 渲染 dark mode（tldraw 本體不動）
