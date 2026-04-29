## Why

Vellum 是 Phase 1 「擁有者自用、感覺像正式產品的 canvas 協作工具」，所有後續模組（Dashboard、Canvas、Sharing、Sync）都依賴一個可用的身份系統來區分「我的 canvases」與「Shared with me」、來決定 WebSocket room 的權限、以及來保護 mutation API。沒有 auth，後面的縱切交付段（M2 Canvas CRUD、M5 Sharing、M6 Sync）都無法獨立驗收。

PRD User Stories #1–#8 是這個模組的範圍：landing 連到 login、Google OAuth、Magic Link、登出、編輯個人資料（顯示名稱與頭像）、UI 語言偏好的持久化（不含全域語言切換器 UI）、active session 列表與遠端登出、永久刪除帳號。Magic Link 寄信走本地 Mailpit；OAuth 走 Google；session / token 持久化走 Drizzle on Postgres。

## What Changes

涵蓋 PRD US #1（landing 連結）、US #2（Google OAuth）、US #3（Magic Link）、US #4（登出）、US #5（編輯個人資料）、US #6（UI 語言偏好持久化部分）、US #7（active session 列表與遠端登出）、US #8（永久刪除帳號）：

- 接入 better-auth（Google OAuth provider + Magic Link provider）並掛載於 `apps/api/src/index.ts` 的 `/api/auth/*` 路徑下。
- 在 `packages/shared/src/db/` 新增 Drizzle schema：`users`、`sessions`、`accounts`、`verification_tokens`（better-auth 標準四表，欄位以 better-auth Drizzle adapter 規範為準）；其中 `users` 額外帶 `locale` 欄位（值為 `zh-TW` 或 `en`）以支援 US #6 的語言偏好持久化。
- 新增 `EmailService` interface（`packages/shared/src/email/types.ts`）與 `MailpitEmailService` 實作（`apps/api/src/email/mailpit.ts`），透過本機 SMTP（`SMTP_HOST=localhost:1025`）寄信；template 用 React Email 渲染（`apps/api/src/email/templates/magic-link.tsx`）。
- 新增 Magic Link 寄信端點（由 better-auth 提供），server 端套用兩條 rate-limit rule：每 email 3 次/10 分鐘、每 IP 10 次/小時；429 回應夾帶 `Retry-After` header。
- 新增 login 嘗試端點 rate-limit：每 IP 10 次/分鐘。
- 所有 auth API 失敗回應使用 `errorKey`（i18n key 字串）而非翻譯後文字。
- 新增前端頁面：`apps/web/src/auth/LoginPage.tsx`（含 Google OAuth 按鈕 + Magic Link form）、`apps/web/src/auth/OAuthCallbackPage.tsx`（Google 回呼處理）、`apps/web/src/auth/MagicLinkVerifyPage.tsx`（點 magic link email 後落地處理 token）。
- 新增前端頁面：`apps/web/src/account/ProfilePage.tsx`（編輯顯示名稱與頭像 URL — Phase 1 不上 cloud upload，僅接受外部圖片 URL）、`apps/web/src/account/SessionsPage.tsx`（active session 列表 + 撤回按鈕）、`apps/web/src/account/DeleteAccountDialog.tsx`（帶輸入 email 確認的永久刪除流程）。
- 在 `apps/web/src/router.tsx` 新增路由：`/login`、`/oauth/callback`、`/auth/verify`、`/account/profile`、`/account/sessions`；以及 protected route guard，未登入導向 `/login`。
- 在 `packages/shared/locales/zh-TW.json` 與 `packages/shared/locales/en.json` 同步補齊 auth 與 account 兩區的全部 UI 字串及 `errorKey` 翻譯。
- 在 `apps/api/.env.example` 補齊 `BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`SMTP_*` 範例值與註解（不是實際值）。

## Non-Goals (optional)

設計一份 design.md 來釐清下列邊界，因此 Non-Goals 同時記在 design.md 的 Goals/Non-Goals 區塊中；此處保留主要排除清單以方便 review：

- 不做匿名訪客 / public-link viewer 的身份系統 — 那屬於 `add-sharing` change。
- 不做頭像雲端上傳 — Phase 2 才上 image cloud upload；Phase 1 只接受外部 URL。
- 不做 2FA / 密碼登入 / Apple / GitHub OAuth — Phase 1 只支援 Google OAuth 與 Magic Link 兩條路徑。
- 不做全域語言切換器 UI — 切換器（top bar 上的下拉）屬於 `add-final-pass`；本 change 只負責 `users.locale` 欄位、寫入 API 與在 login 後讀回。
- 不做真寄信 — Phase 1 只接 Mailpit 本機 SMTP；Resend 是 Phase 2。
- 不做帳號合併（同 email 在 OAuth 與 Magic Link 兩路徑被各自註冊時的合併）— better-auth 預設行為（同 email 視為同一 user）即可，不額外建合併 UI。
- 不做使用者搜尋或公開個人頁 — 個人頁僅本人可見。

## Capabilities

### New Capabilities

- `auth`: Google OAuth + Magic Link 登入流程、登入後 session cookie 設定、登出、未登入導向 login 的 route guard、Magic Link 寄信節流（per-email 與 per-IP）、login 嘗試節流（per-IP）。
- `account`: 已登入使用者個人資料管理 — 編輯顯示名稱與頭像 URL、語言偏好（locale）持久化、active session 列表與遠端登出、永久刪除帳號（連同所有相關資料）。

### Modified Capabilities

(none)

## Impact

- Affected specs:
  - New: `auth`、`account`（兩個新 spec）
- Affected code:
  - New:
    - apps/api/src/auth/index.ts
    - apps/api/src/auth/config.ts
    - apps/api/src/auth/rate-limit.ts
    - apps/api/src/email/types.ts
    - apps/api/src/email/mailpit.ts
    - apps/api/src/email/templates/magic-link.tsx
    - apps/api/src/account/routes.ts
    - apps/api/src/account/delete-account.ts
    - apps/web/src/auth/LoginPage.tsx
    - apps/web/src/auth/OAuthCallbackPage.tsx
    - apps/web/src/auth/MagicLinkVerifyPage.tsx
    - apps/web/src/auth/useAuth.ts
    - apps/web/src/auth/RouteGuard.tsx
    - apps/web/src/account/ProfilePage.tsx
    - apps/web/src/account/SessionsPage.tsx
    - apps/web/src/account/DeleteAccountDialog.tsx
    - packages/shared/src/db/auth-schema.ts
    - packages/shared/src/email/types.ts
    - e2e/auth-magic-link.spec.ts
    - e2e/auth-google-oauth.spec.ts
    - e2e/account-delete.spec.ts
  - Modified:
    - apps/api/src/db/schema.ts (re-export auth schema from shared)
    - apps/api/src/index.ts (mount /api/auth/* and /api/account/* routes; apply rate limits)
    - apps/api/.env.example (uncomment / annotate BETTER_AUTH_SECRET, GOOGLE_*, SMTP_*)
    - apps/web/src/router.tsx (add /login, /oauth/callback, /auth/verify, /account/* routes; route guard wrap)
    - packages/shared/locales/zh-TW.json (add auth.* and account.* keys)
    - packages/shared/locales/en.json (add auth.* and account.* keys)
  - Removed: (none)
- Affected dependencies (already in package.json per scaffolding plan):
  - better-auth (apps/api)
  - @react-email/components and react-email (apps/api, dev)
  - nodemailer or Bun.SMTP equivalent for Mailpit transport (apps/api) — preference: Bun-native if available, else nodemailer
