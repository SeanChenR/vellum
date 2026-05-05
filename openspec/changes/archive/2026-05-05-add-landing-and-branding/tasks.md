## 1. Setup 與依賴

- [x] 1.1 確認 `motion` 已在 apps/web/package.json，依「`motion` 已在 package.json 內，本 milestone 不引入 magicui / animate ui」決議——本 milestone 不新增 npm dep（MagicUI / Animate UI 走 shadcn-CLI copy 模式，需先 wire registry，延後到後續 change）；對應「Motion library dependency is installed and importable」
- [x] 1.2 [P] 把 asset/vellum-favicon.png 複製到 apps/web/src/assets/vellum-favicon.png — 對應「Favicon: PNG 直接連，不轉 ICO / SVG」
- [x] 1.3 [P] 在 apps/web/src/index.html `<head>` 加 `<link rel="icon">`、`<title>`、`<meta name="description">` — 對應「Document head links favicon, title, and description」

## 2. 設計知識蒐集（ui-ux-pro-max）

- [x] 2.1 跑 `python3 ~/.shared/ui-ux-pro-max/scripts/search.py` 涵蓋 product / style / typography / color / landing / ux 六個 domain，把每個 domain 的決議（最終採用的 style category、推薦 typography pairing、hero pattern、動畫節奏、a11y checklist）寫成 `openspec/changes/add-landing-and-branding/design-notes.md` 暫存檔，給後續實作 task 引用——對應「Use ui-ux-pro-max as design knowledge layer, frontend-design as code generator」

## 3. Motion primitives（TDD：red → green）

- [x] 3.1 寫 apps/web/src/motion/primitives.test.tsx：FadeIn / SlideIn（4 個方向）/ ScaleIn / StaggerContainer（80ms 預設 + custom interval）的渲染與 prop forwarding 紅燈測試 — 對應「System provides four reusable motion primitives」
- [x] 3.2 同份測試新增 `prefers-reduced-motion: reduce` 經 `window.matchMedia` mock 為 true 時 duration → 0、不出現 transform offset 的 case — 對應「All motion primitives respect prefers-reduced-motion」
- [x] 3.3 實作 apps/web/src/motion/primitives.tsx 至 3.1–3.2 全綠，內部用 motion lib 的 `useReducedMotion()` — 對應「Motion primitives API: 4 個簡單元件，反映「方向 + 觸發時機」」

## 4. i18n 兩語言同步補 key

- [x] 4.1 [P] 在 packages/shared/src/locales/zh-TW.json 加 `landing.*` / `about.*` / `nav.*` / `footer.*` 與 `landing.mobileNotice.*` 完整 key set，內容引用 2.1 design-notes 內的 hero copy / about narrative / footer 版號 label
- [x] 4.2 [P] 在 packages/shared/src/locales/en.json 鏡射 4.1 的所有 key — 對應「Public-page string set is fully internationalized in zh-TW and en」

## 5. Navbar / Footer / PublicLayout（TDD logic）

- [x] 5.1 [P] 寫 apps/web/src/landing/Navbar.test.tsx：logo 連到 `/`、about 連到 `/about`、login 連到 `/login`、字串都從 `nav.*` 拿 — 對應「Navbar exposes product identity and primary navigation」
- [x] 5.2 [P] 寫 apps/web/src/landing/Footer.test.tsx：顯示 `VELLUM_VERSION`、不含 phase 2 連結（pricing / blog / twitter / linkedin / discord / changelog）— 對應「Footer surfaces version and a single attribution row」
- [x] 5.3 [P] 寫 apps/web/src/landing/PublicLayout.test.tsx：children 包覆 + Navbar + Footer 同時在 — 對應「Public layout shell extracted as `<PublicLayout>` component」
- [x] 5.4 用 frontend-design skill 實作 apps/web/src/landing/Navbar.tsx（吃 2.1 design-notes 的 typography / color / spacing 結論）至 5.1 全綠
- [x] 5.5 [P] 實作 apps/web/src/landing/Footer.tsx 至 5.2 全綠（單行：產品名 + `footer.versionLabel` 帶 VELLUM_VERSION）
- [x] 5.6 實作 apps/web/src/landing/PublicLayout.tsx 至 5.3 全綠（top-level div → Navbar → main → Footer）

## 6. Homepage

- [x] 6.1 寫 apps/web/src/landing/HomePage.test.tsx：hero 包含 product name + tagline + 跳到 `/login` 的 CTA、features section 列出產品能力、整體包在 `<PublicLayout>` 內 — 對應「Public root and about routes render full landing surface」
- [x] 6.2 用 frontend-design skill 實作 apps/web/src/landing/HomePage.tsx，吃 2.1 design-notes 的 landing 結構 + style + typography + color 決議至 6.1 全綠；hero 用 motion + 自家 FadeIn / StaggerContainer 入場（不引入 MagicUI / Animate UI）

## 7. About

- [x] 7.1 寫 apps/web/src/landing/AboutPage.test.tsx：包 PublicLayout、有 heading、至少一個 narrative section（i18n key 不為空）
- [x] 7.2 用 frontend-design skill 實作 apps/web/src/landing/AboutPage.tsx，內容是 craftsmanship narrative（誰用、為何選 Vellum、設計理念），用 SlideIn from='bottom' + 段落 stagger

## 8. Router 接線 + 認證重導

- [x] 8.1 修改 apps/web/src/router.tsx：移除 inline `function HomePage()`、import 新 landing/HomePage、新增 `/about` route 指向 AboutPage、兩個 route component 都包在 PublicLayout 內、保留既有「authenticated 訪客 redirect 到 /dashboard」邏輯——這個 wiring 把「Two new capabilities: `public-pages` + `motion-system`」決議內 public-pages 的兩個 route 與其它已登入 routes 區隔；對應 spec scenarios「Anonymous visitor lands on the Homepage」「Anonymous visitor reads the About page」「Authenticated visitor is redirected away from public routes」
- [x] 8.2 補 router 整合測試（router.test.tsx 或在既有 routing 測試延伸）：驗證 `/` 與 `/about` 都會 render PublicLayout shell、authenticated user 會 redirect 到 /dashboard

## 9. Mobile graceful notice

- [x] 9.1 在 apps/web/src/landing/PublicLayout.tsx 加 `@media (max-width: 767px)` 的 hide-content + show-notice 邏輯（用 Tailwind responsive class 或 styles.css），notice 用 `landing.mobileNotice.*` key — 對應「Public pages display a graceful message on viewports narrower than 768px」
- [x] 9.2 補測試：viewport < 768px 時 PublicLayout 隱藏主要內容、顯示 mobileNotice 文字（用 Testing Library 的 viewport mock 或 jsdom matchMedia mock）

## 10. Dialog enter / exit motion

- [x] 10.1 [P] 修改 apps/web/src/canvas/ShareDialog.tsx：用 `motion.div` + AnimatePresence 包外層 overlay + 內層 panel，opacity 0→1 + scale 0.95→1，180ms — 對應「Dialog enter / exit motion: 套上 `<AnimatePresence>` + scale-fade」與「Existing dialogs receive enter and exit motion」
- [x] 10.2 [P] 修改 apps/web/src/components/CanvasRenameDialog.tsx 同 10.1 樣式
- [x] 10.3 [P] 修改 apps/web/src/components/FolderDeleteDialog.tsx 同 10.1 樣式
- [x] 10.4 [P] 修改 apps/web/src/chrome/MainMenu.tsx 內 DeleteConfirmDialog 同 10.1 樣式
- [x] 10.5 補一個整合測試（任選一個 dialog）：mock `prefers-reduced-motion: reduce` 為 true 時 duration 觀察值為 0、為 false 時 duration 為 180ms

## 11. Dashboard list stagger

- [x] 11.1 修改 apps/web/src/dashboard/DashboardPage.tsx：把 canvas / folder card 列表外層包 `<StaggerContainer>`、每張 card 包 `<FadeIn>`，只在初始 mount stagger — 對應「Dashboard list applies stagger entrance on mount」

## 12. 動畫禁區靜態檢查

- [x] 12.1 寫一個 lint-style 測試（例如 apps/web/src/motion/forbidden-imports.test.ts）：parse `apps/web/src/canvas/Editor.tsx` 與 `apps/web/src/canvas/CollaboratorAvatars.tsx` 的 import，斷言不含 `motion` 或 `motion/primitives` 任一路徑 — 對應「Motion is allowed only on listed surfaces」

## 13. 驗證收斂

- [x] 13.1 `bun test --coverage` 全綠且 motion / landing 新檔案覆蓋率 ≥ 70%
- [x] 13.2 `bunx oxlint` 與 `bunx oxfmt --check` 全綠
- [x] 13.3 `cd apps/web && bun run typecheck` 全綠
- [x] 13.4 跑生產 build（`bun build --target=browser apps/web/src/index.html --outdir=dist --minify`）確認 motion 用法的 dist size delta 合理（< +200KB；motion 已在 base 內，新 page + primitives 不應大幅成長）
- [x] 13.5 對照 ui-ux-pro-max README 的 Pre-Delivery Checklist（visual quality / interaction / light-dark / layout / accessibility）逐條檢查 Homepage 與 About，把不合處修到合 — 涵蓋 prefers-reduced-motion 行為驗證
- [x] 13.6 手動 smoke（在 tmux 起 dev server 後）：開 `http://localhost:3001/` 與 `/about`、確認 favicon / title / description 在 tab 上正確、Hero 動畫流暢、切 OS prefers-reduced-motion 觀察動畫變 0ms、resize viewport < 768px 看到 mobileNotice、登入後 redirect 到 /dashboard 並觀察 dashboard 卡片 stagger、開 ShareDialog 觀察 fade-scale 過場
