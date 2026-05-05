## Why

PRD US 1（新訪客看到 landing page，理解這是什麼工具）目前只由 `apps/web/src/router.tsx:128-160` 內 inline 的 minimal stub 滿足——一張 logo、tagline、一顆 Login 按鈕，沒有 hero、價值主張、適合誰用、為何選 Vellum 等敘事，也沒有 Navbar / Footer / About 的公開介面骨架。M8 是 phase 1 milestone roadmap 的最後 feature 段落，目的是把品牌資產（已宣告於 styles.css 的 4 色 + Inter / Newsreader）與羽毛筆 favicon（`asset/vellum-favicon.png`）整合進公開頁面，並補完 PRD `docs/PRD.md:335` 規定的「Landing / Dashboard / Dialog / Toast 用 motion + MagicUI / Animate UI」動畫範圍。

Discuss 階段確認 phase 1 不做 marketing 深度（pricing / FAQ / testimonials / blog / changelog），但要做完整 public surface：Homepage（重做）+ About 說明頁 + 共用 Navbar + 共用 Footer。

## What Changes

- 新增 `public-pages` capability：路由 `/` Homepage（重做）與 `/about` About 說明頁；共用 `<PublicLayout>`（Navbar + main + Footer）包覆兩個頁面；皆走 i18n（zh-TW + en 同步）。
- 新增 `motion-system` capability：使用既有 `motion`（framer-motion 後繼，已在 `apps/web/package.json`）；提供共用 `<FadeIn>` / `<SlideIn>` / `<ScaleIn>` / `<StaggerContainer>` primitives；定義動畫適用 / 禁用區域（Landing / Dashboard list / Dialog enter-exit / Toast 用；canvas 內 / multiplayer cursor / presence 不用）；既有 Dashboard、ShareDialog、CanvasRenameDialog、FolderDeleteDialog 套用 primitives。MagicUI / Animate UI 是透過 shadcn CLI copy-into-source 的元件庫——本 milestone 不引入（repo 尚未 wire shadcn registry），延後到後續 change。
- 新增 favicon：把 `asset/vellum-favicon.png` 複製到 `apps/web/src/assets/` 並於 `apps/web/src/index.html` 用 `<link rel="icon">` 連結；同時補 `<title>` 與 `<meta name="description">`。
- 設計流程整合：`design.md` 內把 ui-ux-pro-max（CSV 設計知識搜尋庫，位於 `~/.shared/ui-ux-pro-max/`）的 search workflow 寫進實作前置步驟——先用 product / style / typography / color / landing / ux 六個 domain 蒐集設計參考，再用 `frontend-design` skill 生成具識別度的 React + Tailwind 程式碼。
- i18n 增加四個 namespace：`landing.*` / `about.*` / `nav.*` / `footer.*`，zh-TW + en 同 PR 補齊。
- `apps/web/src/router.tsx` 移除 inline HomePage 函式，改 import 新的 `landing/HomePage`；新增 `/about` route。
- 既有 in-app surfaces（Dashboard list、Dialog 系列、Toast）套上 motion primitives——這是 motion-system capability 的應用範例，也修改既有頁面行為。

## Non-Goals

- **不做 marketing 深度頁**：pricing / FAQ / testimonials / blog / changelog / press 全部 phase 2+。
- **不做 mobile 響應式**（< 768px）：phase 1 out-of-scope guard 已禁，landing 也不破例。
- **不做 dark mode**：phase 1 全站只有一個 light 風格，dark 是 phase 2。
- **不做 SVG logo 化**：沿用 `asset/vellum-logo-removebg.png`（透明 PNG）；`asset/vellum-favicon.png` 直接拿來當 favicon，phase 1 不做向量轉檔。
- **不在 canvas 內加動畫**：tldraw 自帶動畫時序，加 motion 會 jitter（hard rule #5）。
- **不在 multiplayer cursor / presence 加動畫**：cursor 必須 instant feedback。
- **不做 SEO / analytics / OpenGraph image / structured data**：phase 1 是 craftsmanship-driven，不是 acquisition-driven；只做 `<title>` + `<meta description>` 兩個基本。
- **不重做 brand tokens**：sticking with `styles.css` 既有 ink-navy / parchment-cream / warm-sepia / off-white + Inter + Newsreader。
- **不在 phase 1 為 PublicLayout 加 dark mode toggle、語言切換 dropdown、登入狀態下的動態 nav**：登入後直接 redirect 到 dashboard（既有行為），nav 對未登入訪客固定樣式。

## Capabilities

### New Capabilities

- `public-pages`: 公開（未登入訪客可見）路由的頁面集合——Homepage / About，共用 Navbar + Footer 與 PublicLayout 殼，含 i18n 與 favicon / page title / meta description 連結。
- `motion-system`: 動畫底層整合——motion / MagicUI / Animate UI 三個 npm 套件 wire、共用 motion primitives（FadeIn / SlideIn / ScaleIn / StaggerContainer）、適用 / 禁用區域規則，以及 Dashboard / Dialog / Toast 既有 surface 的 primitives 套用。

### Modified Capabilities

(none — Dashboard / Dialog 內套上 motion primitives 屬於 motion-system 的應用，不改變 dashboard / canvas-editor 的 behaviour spec 文字)

## Impact

- Affected specs: `public-pages`（新）、`motion-system`（新）
- Affected code:
  - New:
    - apps/web/src/landing/HomePage.tsx
    - apps/web/src/landing/HomePage.test.tsx
    - apps/web/src/landing/AboutPage.tsx
    - apps/web/src/landing/AboutPage.test.tsx
    - apps/web/src/landing/Navbar.tsx
    - apps/web/src/landing/Navbar.test.tsx
    - apps/web/src/landing/Footer.tsx
    - apps/web/src/landing/Footer.test.tsx
    - apps/web/src/landing/PublicLayout.tsx
    - apps/web/src/landing/PublicLayout.test.tsx
    - apps/web/src/motion/primitives.tsx
    - apps/web/src/motion/primitives.test.tsx
    - apps/web/src/assets/vellum-favicon.png
  - Modified:
    - apps/web/src/router.tsx
    - apps/web/src/index.html
    - apps/web/package.json
    - bun.lock
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
    - apps/web/src/styles.css
    - apps/web/src/canvas/ShareDialog.tsx
    - apps/web/src/components/CanvasRenameDialog.tsx
    - apps/web/src/components/FolderDeleteDialog.tsx
    - apps/web/src/dashboard/DashboardPage.tsx
  - Removed: (none)
- Dependencies: 沿用既有 `motion`（已在 `apps/web/package.json`）；本 milestone 不新增 npm dep。MagicUI / Animate UI 是 shadcn-CLI copy-into-source 元件庫，本 milestone 不引入（repo 尚未 wire shadcn registry），延後到後續 change。
- 不動 server / DB / WS / 外部 API
