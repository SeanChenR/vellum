## 1. i18n key 補完

- [x] 1.1 [P] 在 packages/shared/src/locales/zh-TW.json 內 `nav.userMenu` 加 `dashboard` 鍵（值「返回 Dashboard」），對應「User avatar menu surfaces a Go-to-Dashboard entry」spec scenario「Both locales define the new menu key」
- [x] 1.2 [P] 在 packages/shared/src/locales/en.json 鏡射 1.1 的 key（值「Go to Dashboard」）

## 2. UserAvatarMenu 加 Dashboard item（TDD）

- [x] 2.1 寫（或補強）apps/web/src/components/UserAvatarMenu.test.tsx：assert 開啟 menu 後 4 個 items 順序為 Go to Dashboard / Profile / Sessions / Sign out、Dashboard item href 為 `/dashboard`、字串從 `nav.userMenu.dashboard` 拿
- [x] 2.2 修改 apps/web/src/components/UserAvatarMenu.tsx：在現有 Profile 項之上插入 Go to Dashboard 連結至 5「UserAvatarMenu 加 Go to Dashboard 永遠顯示」決議——`<a href="/dashboard">{t("nav.userMenu.dashboard")}</a>` + role="menuitem" + 既有 hover / focus styles 一致

## 3. Navbar auth-aware（TDD）

- [x] 3.1 修改 apps/web/src/landing/Navbar.test.tsx：紅燈測試 isAuthenticated=true 時不渲染 Sign-in CTA、改渲染 UserAvatarMenu；isAuthenticated=false 時相反；isLoading=true 時渲染固定寬度 placeholder——對應「Navbar exposes product identity and primary navigation」spec 內三個 auth-aware scenarios
- [x] 3.2 修改 apps/web/src/landing/Navbar.tsx 至 3.1 全綠：呼叫 `useAuth()`、依「Navbar auth-aware：右側根據 useAuth 切換」決議實作三分支；mock useAuth 應為標準 hook mock 模式（與 RouteGuard.test 一致）
- [x] 3.3 補測試：placeholder 寬高與 Sign-in CTA 寬高一致（class 比對或 getBoundingClientRect 比對），確保 CLS 不發生——對應 spec scenario「Auth state still loading shows fixed-width placeholder」

## 4. PublicLayout 涵蓋 Login + 解除 redirect

- [x] 4.1 [P] 修改 apps/web/src/landing/PublicLayout.test.tsx：assert 包入 Login form 後 Navbar / Footer 仍在；mobile graceful notice 在 < 768px 時優先顯示
- [x] 4.2 [P] 修改 apps/web/src/auth/LoginPage.test.tsx：移除既有「自身 minimal 布局」的 assertion，改 assert LoginPage 渲染的內容只是 form 本體（不含外殼）
- [x] 4.3 修改 apps/web/src/auth/LoginPage.tsx：拿掉 inline 的 centered min-h-screen 包裝，只留 form 與相關 LoginForm composition；外殼由 router 包入 PublicLayout 提供
- [x] 4.4 修改 apps/web/src/router.tsx：依「Login 頁包 PublicLayout、不解除 already-authenticated 的進入」決議將 `loginRoute` 的 component 包進 `<PublicLayout>`；依「解除公開頁 auto-redirect」決議拿掉 PublicRoute 內 `if (isAuthenticated) return <Navigate to="/dashboard" />` 分支，改為一律渲染 PublicLayout——對應「Public root and about routes render full landing surface」MODIFIED 內 scenarios「Authenticated visitor sees public pages without redirect」與「Login page is wrapped in PublicLayout」

## 5. AppLayout 新建（TDD）

- [x] 5.1 寫 apps/web/src/landing/AppLayout.test.tsx：assert 渲染 Navbar、main 包 children、不渲染 Footer、不渲染 mobile graceful notice——對應「Authenticated routes share an AppLayout shell that reuses the Navbar」spec scenarios
- [x] 5.2 新建 apps/web/src/landing/AppLayout.tsx：top-level div → `<Navbar/>` → `<main>{children}</main>`，無 Footer、無 mobile notice——依「拆 PublicLayout 與 AppLayout 兩層殼，共用 Navbar」決議

## 6. Dashboard / Profile / Sessions 改用 AppLayout

- [x] 6.1 [P] 修改 apps/web/src/dashboard/DashboardPage.tsx：移除 AppHeader 引用，外層用 `<AppLayout>` 包覆既有 main 內容
- [x] 6.2 [P] 修改 apps/web/src/account/ProfilePage.tsx：同 6.1 樣式
- [x] 6.3 [P] 修改 apps/web/src/account/SessionsPage.tsx：同 6.1 樣式
- [x] 6.4 修改 apps/web/src/dashboard/DashboardPage.test.tsx：assert AppLayout 包覆（Navbar 在）、AppHeader 不再被引用
- [x] 6.5 [P] 補修 apps/web/src/account/ProfilePage.test.tsx 內 AppHeader 引用（若有）
- [x] 6.6 [P] 補修 apps/web/src/account/SessionsPage.test.tsx 內 AppHeader 引用（若有）

## 7. AppHeader 完全移除

- [x] 7.1 刪除 apps/web/src/components/AppHeader.tsx；保留 i18n key `nav.backToDashboard` 於兩語系 locale（依「AppHeader 完全刪除」決議內 Risk mitigation——key 可被未來元件複用）
- [x] 7.2 全 repo grep 確認沒有任何剩餘 import 引用 AppHeader

## 8. Canvas 編輯器路由保留 TopBar

- [x] 8.1 確認 apps/web/src/canvas/CanvasPage.tsx 與 apps/web/src/canvas/Editor.tsx 沒被 AppLayout 包覆——對應「Canvas editor is excluded from AppLayout」spec scenario；補一個靜態斷言測試（apps/web/src/landing/AppLayout.forbidden.test.ts 或在 router.test 裡）assert canvasRoute 的 component 樹不含 AppLayout

## 9. 驗證收斂

- [x] 9.1 `bun test apps/web` 全綠（baseline 16 個 pre-existing fail 不算 regression），新測試覆蓋率 ≥ 70%
- [x] 9.2 `bunx oxlint apps/web/src` 0 warnings 0 errors
- [x] 9.3 `cd apps/web && bun run typecheck` 全綠
- [x] 9.4 手動 smoke（在 tmux 起 dev server 後）：
  - 未登入訪客 → `/` 看到 Navbar 右側 Sign in CTA
  - 未登入訪客 → `/login` 看到 Navbar + 表單 + Footer
  - 登入訪客 → `/` 看到 Navbar 右側頭像 dropdown 含 Go to Dashboard
  - 登入訪客 → `/dashboard` 看到 Navbar（無 Footer）+ 既有 Dashboard 內容
  - 登入訪客 → `/canvas/<id>` 看到既有 TopBar（不是 AppLayout）
  - Logo 從每個 surface 點下去都到 `/`
