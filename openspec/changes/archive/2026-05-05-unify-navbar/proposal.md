## Summary

統一 Navbar：把公開頁、Login、Dashboard 三個 surface 都用同一個 auth-aware Navbar；已登入訪客解除 `/` 與 `/about` 的自動 redirect；頭像下拉新增「Go to Dashboard」入口。

## Motivation

目前三個 surface 各自有自己的 header 變體：

- **公開頁（`/`、`/about`）**：用 M8 引入的 `Navbar`，右側永遠是 Sign-in CTA；遇到已登入訪客就 `<Navigate to="/dashboard"/>` 強制跳走。
- **Login 頁（`/login`）**：自己的 minimal 布局，沒 Navbar，只有 form 置中。
- **Dashboard / 帳號頁**：用 `apps/web/src/components/AppHeader.tsx`，logo 連到 `/dashboard`、右側是 `UserAvatarMenu`。

三個 header 樣貌、字距、padding、border、高度都各自一份；改 logo 或加新 nav item 要動三處。已登入訪客被強迫離開公開頁也是個怪行為——他們可能想看 Homepage 的最新文案、或從外部 link 點進 `/about`，沒理由把他們踢回 dashboard。

「不想做一半」的取向下，phase 1 收尾前統一這個會讓後續 milestone（M9 i18n / a11y、phase 2 marketing 加強）的 surface 都共用同一條 Navbar；改一處生效到全站。

## Proposed Solution

- **`Navbar` 變 auth-aware**：右側根據 `useAuth()` 結果切換——未登入顯示 Sign-in CTA、已登入顯示 `UserAvatarMenu`（複用既有 `apps/web/src/components/UserAvatarMenu.tsx`）。logo 永遠連到 `/`，無論登入狀態。
- **`UserAvatarMenu` 新增「Go to Dashboard」item**：放在最上面（在 Profile 之上），i18n key `nav.userMenu.dashboard`，連到 `/dashboard`。當 menu 被叫起來的 surface 本身已經是 dashboard 時，這個 item 仍顯示（不做隱藏邏輯，避免狀態複雜）。
- **解除公開頁 auto-redirect**：`apps/web/src/router.tsx` 內 `PublicRoute` 拿掉「`isAuthenticated → <Navigate to="/dashboard"/>`」分支；已登入訪客在 `/` 與 `/about` 看到一樣的 public surface，只是右上角是頭像。
- **Login 頁改包 `PublicLayout`**：`apps/web/src/auth/LoginPage.tsx` 不再自己畫布局，改包在 `<PublicLayout><LoginForm /></PublicLayout>` 內；Navbar 上 Sign-in CTA 在 Login 頁仍顯示（連回 `/login` 自身——visual feedback，不破功能）。
- **`AppHeader` 移除**：`apps/web/src/dashboard/DashboardPage.tsx` 與 `apps/web/src/account/ProfilePage.tsx` / `SessionsPage.tsx` 改用同一個 `Navbar`，搭配新拆出的 `AppLayout` 殼（類似 PublicLayout，但無 mobile-graceful-notice、無 Footer）。`apps/web/src/components/AppHeader.tsx` 連同其引用全部刪除。
- **i18n**：新增 `nav.userMenu.dashboard` zh-TW / en。

## Non-Goals

- **不改 canvas 編輯器頁的 TopBar**：`/canvas/:id` 是工作面，TopBar 帶 canvas-specific 控制（rename / share / breadcrumb / presence avatars / connection status），跟 Navbar 職責不同；不統一。
- **不做語言切換 dropdown 進 Navbar**：跟 phase 1 out-of-scope guard 一致，瀏覽器 detect 即可。
- **不為已登入 / 未登入做不同 logo 連結**：永遠 → `/`，避免狀態散在元件邏輯內。
- **不在 Login 頁做「signed-in 自動 redirect 到 /dashboard」的逆向行為**：已登入訪客點 Login link 仍進 `/login` 看到登入畫面（其實沒登入需求但不擋）。
- **不重做 `UserAvatarMenu` 的 dropdown 開啟動畫 / focus trap**：那是 M9 a11y 範圍。

## Alternatives Considered

- **logo 行為 auth-aware（未登入 → `/`、已登入 → `/dashboard`）**：對已登入 user 少一個 click，但邏輯散在元件內 + 視覺上同一個 Navbar 有兩種行為；reject。
- **保留 `AppHeader`、只把 Navbar 加進 Login 頁**：part-fix，三個 header 變兩個但仍不一致；reject。
- **Login 頁也解除 redirect、讓已登入 user 看到 login form**：等同沒登入流程；reject。
- **完全合 Navbar / TopBar 成單一元件**：TopBar 帶 canvas-specific props（canvasId / folder / share dialog state），合進來會讓 Navbar API 膨脹；reject。

## Impact

- Affected specs: `public-pages`（modify — Navbar 行為從固定變 auth-aware；redirect 規則放寬；Login 頁納入 PublicLayout）
- Affected code:
  - New:
    - apps/web/src/landing/AppLayout.tsx（authenticated routes 共用殼，Navbar + main + 無 Footer）
    - apps/web/src/landing/AppLayout.test.tsx
  - Modified:
    - apps/web/src/landing/Navbar.tsx（加 useAuth、auth-aware 右側）
    - apps/web/src/landing/Navbar.test.tsx
    - apps/web/src/landing/PublicLayout.tsx（Login 頁也會用，主要內容區自適應）
    - apps/web/src/landing/PublicLayout.test.tsx
    - apps/web/src/components/UserAvatarMenu.tsx（新增 dashboard menu item）
    - apps/web/src/components/UserAvatarMenu.test.tsx（若不存在則新建）
    - apps/web/src/router.tsx（PublicRoute 拿掉 redirect、`/login` 包進 PublicLayout、authenticated routes 改用 AppLayout）
    - apps/web/src/router.test.tsx
    - apps/web/src/auth/LoginPage.tsx（移除 inline 布局、由 PublicLayout 包覆）
    - apps/web/src/auth/LoginPage.test.tsx
    - apps/web/src/dashboard/DashboardPage.tsx（移除 AppHeader import、改用 AppLayout）
    - apps/web/src/dashboard/DashboardPage.test.tsx
    - apps/web/src/account/ProfilePage.tsx（同上）
    - apps/web/src/account/SessionsPage.tsx（同上）
    - packages/shared/src/locales/zh-TW.json（加 `nav.userMenu.dashboard`）
    - packages/shared/src/locales/en.json
  - Removed:
    - apps/web/src/components/AppHeader.tsx
- Dependencies: 無新增 npm dep；複用既有 `useAuth` / `UserAvatarMenu` / motion primitives。
- 不動 server / DB / WS / canvas 編輯器內。
