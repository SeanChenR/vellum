## Context

當前 (在 commit `25f6ba4` 之後)：

- M8 已交付公開頁面（`/` Homepage、`/about` AboutPage）+ 共用 `Navbar` + `Footer` + `PublicLayout`，但 Navbar 右側永遠顯示 Sign-in CTA，已登入訪客被 `apps/web/src/router.tsx` 內 `PublicRoute` 強制 `<Navigate to="/dashboard"/>`。
- Login 頁（`apps/web/src/auth/LoginPage.tsx`）有自己的 minimal 布局（Tailwind centered form），沒 Navbar、沒 Footer。
- Dashboard / 帳號頁用 `apps/web/src/components/AppHeader.tsx`：clickable Vellum logo 連到 `/dashboard`、右側是 `UserAvatarMenu`、白底、高 14。
- 既有 `apps/web/src/components/UserAvatarMenu.tsx` 提供 Profile / Sessions / Sign out 三個 menu items，沒有「Go to Dashboard」入口（因為它本來就只在 dashboard 自己用）。
- 既有 `apps/web/src/auth/useAuth.ts` 提供 `{ user, isAuthenticated, isLoading, logout }` hook。

PRD US 1（新訪客看到 landing page）跟 PRD User Stories 17–18（已登入訪客的 dashboard 流）目前用不同 header 殼撐起；M9 即將開始的 i18n / a11y 工作會 audit 整個 chrome surface，先把 header 統一掉可以避免 audit 工作做兩遍。

## Goals / Non-Goals

**Goals**：

- 公開頁、Login 頁、Dashboard、Profile、Sessions 共用同一個 `Navbar` 元件——logo 行為、字距、padding、border、高度都一致。
- `Navbar` 右側根據 `useAuth()` 結果切換：未登入顯示 Sign-in CTA、已登入顯示 `UserAvatarMenu`；切換時不出現布局抖動（`isLoading` 期間不閃爍）。
- 已登入訪客可在 `/` 與 `/about` 看到 public surface（不被強制 redirect）；要進 dashboard 透過頭像下拉內的 Go to Dashboard。
- `UserAvatarMenu` 從原本三個 item（Profile / Sessions / Sign out）變四個（Go to Dashboard / Profile / Sessions / Sign out），且兩種語言（zh-TW / en）同步。
- `AppHeader.tsx` 完全刪除——讓未來改 nav 不需要動兩處。
- 一個 PR 包，不分批。

**Non-Goals**：

- 不改 canvas 編輯器頁 `TopBar`（PRD 工作面職責）。
- 不為 logo 做 auth-aware 連結。
- 不為 dashboard / 帳號頁加 Footer（appLayout 不掛 Footer）。
- 不重做 `UserAvatarMenu` dropdown 的鍵盤導航 / focus trap（M9 範圍）。
- 不在 Navbar 加語言切換 / 主題切換（phase 2+）。
- 不擋已登入訪客進 `/login`（容許他們看到 form，沒登入需求但不擋——避免新邏輯）。

## Decisions

### 拆 PublicLayout 與 AppLayout 兩層殼，共用 Navbar

`PublicLayout`（既有）：頂層 div → `<Navbar/>` → `<main>{children}</main>` → `<Footer/>` + 768px 以下 mobile graceful notice。用於 `/` `/about` `/login`。

新增 `AppLayout`（`apps/web/src/landing/AppLayout.tsx`）：頂層 div → `<Navbar/>` → `<main>{children}</main>`（無 Footer、無 mobile graceful notice，因為 dashboard / 帳號頁是工作介面，預設假設桌面瀏覽且不需要品牌 footer 重複）。用於 `/dashboard` `/profile` `/sessions`。

兩個 Layout 都引用同一個 `Navbar` 元件——Navbar 自己處理 auth-aware 邏輯，不依賴外層殼判斷。

**Rationale**：
- 公開頁有 marketing 訴求（Footer 講 made-with-care、版號），dashboard 是工作介面、把 footer 放上去會讓內容區擠。
- mobile graceful notice 是為「未登入訪客誤點到 mobile share link」做的；已登入訪客不該在 dashboard 看到「請改用桌面」的訊息（他們是有意識選擇進來工作的）。
- Layout 雖兩個但 Navbar 只一個——改 logo / nav item 永遠改一處。

**Alternatives considered**：
- 一個 Layout、用 prop `showFooter?: boolean` 開關：prop 越多 layout 邏輯越散；reject。
- 三個 Layout（Public / Auth / App）：Login 跟公開頁的差異只是「不該有 mobile 反彈」；多分一層收益太小；reject。

### Navbar auth-aware：右側根據 useAuth 切換

`Navbar` 內部呼叫 `useAuth()`：
- `isLoading === true` → 右側保留固定寬度的 placeholder（`<div className="w-24 h-9" />`），避免內容跳動（CLS）。
- `isAuthenticated === false` → 渲染 Sign-in CTA（連到 `/login`）。
- `isAuthenticated === true` → 渲染 `<UserAvatarMenu user={user} onSignOut={logout} />`。

logo 永遠連到 `/`（spec 既有）；中間 nav 的 About link 永遠顯示。

**Rationale**：
- `useAuth` 已經是 client-only React hook（`react-query` 跟 cookie 取得 session），整個 app 都在 React tree 內、不需要再加 SSR / 等待。
- placeholder 寬高用 Sign-in CTA 的尺寸來算，這樣 `isLoading → isAuthenticated=false` 跟 `isLoading → isAuthenticated=true` 都不抖。
- `useAuth` 已被 dashboard、editor、route guard 用過，沒新風險。

**Alternatives considered**：
- Navbar 只看 `isAuthenticated`、不處理 `isLoading`：第一次 render 會閃 Sign-in 後跳成頭像，CLS 差；reject。
- Navbar 不 call hook、由 props 傳入 `currentUser`：caller 都要塞 `useAuth` 結果一次，重複；reject。

### UserAvatarMenu 加 Go to Dashboard 永遠顯示

新 menu item 放在最上方（`Go to Dashboard` → `Profile` → `Sessions` → `Sign out`）。當 user 已經在 `/dashboard` 點開頭像 menu，這個 item 仍顯示——點下去 navigate 到 `/dashboard`、若 router 偵測 already-on 直接 noop（TanStack Router 預設行為）。

i18n key 加在現有的 `nav.userMenu.*` namespace 下：`nav.userMenu.dashboard`。zh-TW = "返回 Dashboard"（已經有 `nav.backToDashboard` 但那是 AppHeader 的 logo aria-label，不重複）；en = "Go to Dashboard"。

**Rationale**：
- 永遠顯示比「在 dashboard 隱藏」的條件渲染簡單——less surface area for bugs。
- TanStack Router 的 `<a href="/dashboard">` 已支援 SPA 內 navigation；不需要 `useNavigate`。
- 把新 item 放第一是因為這是「工作目的地」入口，比 Profile / Sessions（個人設定）優先級高。

**Alternatives considered**：
- 在 dashboard 自己隱藏這個 item：得在 menu 內讀 `useLocation`、增加 dependency 與測試 case；reject。
- 拿掉 Profile / Sessions、合併成「Account」單一 item：超出本 change 範圍；reject。

### 解除公開頁 auto-redirect

`apps/web/src/router.tsx` 內 `PublicRoute`：

```typescript
// before
if (isAuthenticated) return <Navigate to="/dashboard" />;
return <PublicLayout>{children}</PublicLayout>;

// after
return <PublicLayout>{children}</PublicLayout>;
```

`isLoading` 期間仍渲染 loading 畫面（既有行為保留），但不再 redirect 已登入訪客。

**Rationale**：
- 已登入訪客點外部 `/about` link 不該被踢走；要去 dashboard 透過頭像下拉。
- 拿掉 redirect 後 `useAuth` 對 PublicRoute 的影響只剩 loading 分支——更乾淨。
- 已登入訪客在 `/` 看到 hero，CTA 仍顯示「Get started」連到 `/login`——點下去進 LoginPage（不擋）會再轉一次（既有 PostLogin 行為）。這個微小循環 UX 不漂亮但不破功能；M9 / phase 2 可加「signed-in 看到 CTA 變 Go to Dashboard」優化。

**Alternatives considered**：
- 已登入訪客在 `/` 看到 hero 但 CTA 文字變「Go to Dashboard」：合理但要在 HomePage 內加 useAuth + 條件渲染；現在範圍外、phase 2 加；reject。
- 加 `?force=public` query param 讓 dashboard user 主動進公開頁：複雜化 URL；reject。

### Login 頁包 PublicLayout、不解除 already-authenticated 的進入

`apps/web/src/auth/LoginPage.tsx` 移除自己的 minimal 布局（centered form），改成只渲染 `<LoginForm />` 等內容；router 把 `/login` route component 包進 `<PublicLayout>`。

已登入訪客若不小心進 `/login`，照 render 登入畫面——不加新的 redirect 邏輯。

**Rationale**：
- Login 頁有 marketing context（user 第一次決定要不要登入），跟公開頁一致 brand voice 比較連貫。
- 不擋 already-authenticated user 進來——他們可能是測試 / debug / 切換帳號需要重新登入；擋了反而怪。
- 風險：已登入 user 在 Login 頁 submit 會觸發 login flow 第二次。可接受——better-auth 拒絕重複 session、會顯示既有 errors.invalidCredentials toast，UX 不漂亮但不破功能。

**Alternatives considered**：
- Login 頁加「signed-in → /dashboard」redirect：對稱，但 phase 1 已經有太多 redirect 規則；reject。
- 若 already-authenticated 顯示「You're already signed in. Go to dashboard?」訊息：phase 2 polish；reject。

### AppHeader 完全刪除

`apps/web/src/components/AppHeader.tsx` 連同其引用（`apps/web/src/dashboard/DashboardPage.tsx`、`apps/web/src/account/ProfilePage.tsx`、`apps/web/src/account/SessionsPage.tsx`）全部換掉。`apps/web/src/account/ProfilePage.test.tsx`、`SessionsPage.test.tsx`、`DashboardPage.test.tsx` 內若有 assert AppHeader 字串的，跟著改。

**Rationale**：
- 留著會誤導未來 contributor「dashboard 用這個 header」；硬刪 + 改 tests 一次到位。
- AppHeader 內已有的 `nav.backToDashboard` i18n key 仍由 Navbar logo 的 `aria-label` 沿用（`nav.brand` 為主、`nav.backToDashboard` 為輔），不刪 i18n key。

**Alternatives considered**：
- 把 AppHeader 重構成 thin wrapper 內部 render `<Navbar/>`：保留檔案、零成本相容，但留著會混淆；reject。
- 把 AppHeader 留在 codebase、加 `@deprecated` JSDoc：phase 1 不該帶死碼進入 phase 2；reject。

## Risks / Trade-offs

- **[Risk] 已登入訪客在 `/` Hero CTA 點下去進 `/login` 看到登入畫面，混亂** → Mitigation：CTA 內文 i18n key 不變（仍是 Get started），但 phase 2 marketing 加強時可加「signed-in 看到 CTA 變 Go to Dashboard」的條件渲染。本 change 不為這個微 UX 加複雜度，先讓功能可用。
- **[Risk] `useAuth` 在 Navbar 內 mount 時的 `isLoading` 期間反覆 render（每次路由切換重新 fetch）** → Mitigation：既有 `useAuth` 用 `useQuery` cache 過 session，只有第一次 mount 真的等；之後路由切換是 cache hit。Navbar 的 placeholder 寬高固定，反覆 render 不影響 CLS。
- **[Risk] AppHeader 刪掉後 `nav.backToDashboard` i18n key 失去引用** → Mitigation：保留 key（Navbar logo `aria-label` 改用 `nav.brand`，但 `nav.backToDashboard` 仍可被未來元件用）；不刪 i18n key 比刪錯了找不回來安全。本 change tasks 內顯式列「保留 i18n key」這條。
- **[Risk] LoginPage 包 PublicLayout 後寬度跟原本差異大，form 看起來變窄** → Mitigation：PublicLayout 主內容區是 `mx-auto max-w-6xl` 但 LoginPage 內 LoginForm 自己會限寬（`max-w-md` centered），視覺不會變寬；mobile graceful notice 在 < 768px 觸發，但 Login 流程在桌面比例最常用，不影響主流。
- **[Trade-off] 已登入訪客在 `/login` 看登入畫面而非被踢走** → 嚴格說會讓 first-time user 跟 already-signed-in user 看到一樣畫面，但避免新 redirect 規則 + 給測試帳戶切換留彈性。phase 2 可加。
- **[Trade-off] Logo 永遠 → `/`** → 已登入 user 想回 dashboard 多一步（透過 avatar dropdown）；但邏輯單純化的長期收益大於這一步成本。GitHub / Linear / Notion 都這樣。
- **[Trade-off] PublicLayout 的 mobile graceful notice 同樣套到 Login 頁** → < 768px 訪客點 `/login` 會看到「Best on a desktop browser」而非 login form。phase 1 PRD out-of-scope guard 已禁 mobile，這個延伸合理；若有人用手機分享 magic link 點進來會被擋——可接受，登入流程本來就期待桌面。
