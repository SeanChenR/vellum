## 1. 前置 — Schema 與 Email 抽象（依賴根基）

- [x] 1.1 [P] 在 `packages/shared/src/db/auth-schema.ts` 定義 better-auth 標準四張表（`users`、`sessions`、`accounts`、`verification_tokens`），其中 `users` 多一欄 `locale: text` 預設 `'zh-TW'` 並加 check constraint 限定 `'zh-TW' | 'en'`；export 對應的 `User`、`Session`、`Account`、`VerificationToken` TypeScript types
- [x] 1.2 [P] 在 `packages/shared/src/email/types.ts` 定義 `EmailService` interface — 一個 method `send({ to, subject, html, text }): Promise<void>`；無實作，純 type
- [x] 1.3 修改 `apps/api/src/db/schema.ts` 從 `packages/shared/src/db/auth-schema.ts` re-export 上述四張表
- [x] 1.4 用 `bunx drizzle-kit generate` 產生 migration；review SQL 確認 `users.locale` constraint 有落實；`bunx drizzle-kit migrate` 套到本地 Neon test branch
- [x] 1.5 [P] 修改 `apps/api/.env.example`：補完 `BETTER_AUTH_SECRET`（範例 `change-me-32-bytes-hex`）、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 註解（標明 `Get from https://console.cloud.google.com`）、確認 `SMTP_HOST=localhost` `SMTP_PORT=1025` `SMTP_FROM=noreply@vellum.local`

## 2. Tests First — Server 單元測試（紅燈先行）

- [x] 2.1 寫失敗測試 `apps/api/src/email/mailpit.test.ts`：用 `mock.module('nodemailer')` 注入假 transport；驗證 `MailpitEmailService.send` 把 `{ to, subject, html, text }` 正確傳給 transport.sendMail；transport throw 時 `send` 也 throw
- [x] 2.2 [P] 寫失敗測試 `apps/api/src/auth/rate-limit.test.ts`：覆蓋 Magic Link login request 的兩條規則（per-email 3/10min、per-IP 10/hr）以及 login 嘗試 per-IP 10/min；超限回 `{ allowed: false, retryAfterSeconds }` 且 retryAfterSeconds 取兩條規則中較大者
- [x] 2.3 [P] 寫失敗測試 `apps/api/src/auth/magic-link.test.ts`：Magic Link verification 端點對「過期 token」、「已用 token」、「未知 token」、「合法未用 token」四個 scenario 的回應行為；確認合法 token 會 mark `used_at` 並 set 1 個 session cookie
- [x] 2.4 [P] 寫失敗測試 `apps/api/src/auth/google-oauth.test.ts`：Google OAuth login state mismatch 拒絕、provider error 拒絕、首次登入建 user row 並 redirect to `/dashboard`、回流登入重用既有 user row
- [x] 2.5 [P] 寫失敗測試 `apps/api/src/auth/logout.test.ts`：authenticated logout 刪 session row + clear cookie；unauthenticated logout 仍回 200 idempotent
- [x] 2.6 [P] 寫失敗測試 `apps/api/src/auth/route-guard.test.ts`：protected route guard 對無 session、revoked session、合法 session 三種情況的回應；errorKey 必為 `auth.errors.notAuthenticated` / `auth.errors.sessionRevoked`
- [x] 2.7 [P] 寫失敗測試 `apps/api/src/account/profile.test.ts`：read profile 與 update profile 五個 scenario（合法 name、非 https image 拒、locale 持久化、不支援 locale 拒、email 欄位不可 patch）
- [x] 2.8 [P] 寫失敗測試 `apps/api/src/account/sessions.test.ts`：list active sessions 排除 revoked；revoke session（他機 / 當前 / 他人 ID）三條 scenario
- [x] 2.9 [P] 寫失敗測試 `apps/api/src/account/delete-account.test.ts`：delete account 四個 scenario（confirmEmail 一致刪除並 cascade、不一致拒、case-insensitive 接受、未登入 401）
- [x] 2.10 [P] 寫失敗測試 `apps/api/src/auth/error-key-contract.test.ts`：scan 所有 auth + account 端點失敗回應，斷言 envelope 為 `{ error: { errorKey: string } }` 且 errorKey 同時存在於 `packages/shared/locales/zh-TW.json` 與 `packages/shared/locales/en.json`
- [x] 2.11 [P] 寫失敗測試 `apps/api/src/auth/logger-redaction.test.ts`：對 magic-link send 端點觸發任何 log，斷言 log 內容不含原始 token、email body、`Authorization`/`Cookie` header
- [x] 2.12 [P] 寫失敗測試 `apps/api/src/auth/session-cookie.test.ts`：login 成功的 `Set-Cookie` header 包含 `HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`，且 cookie value 不含 user id/email/token

## 3. Tests First — Web 互動測試（component test，紅燈先行）

- [x] 3.1 寫失敗測試 `apps/web/src/auth/LoginPage.test.tsx`：渲染 Google OAuth 按鈕與 Magic Link form；Magic Link form submit 呼叫 fetch；server 回 emailRateLimited 時顯示對應 i18n key 的訊息
- [x] 3.2 [P] 寫失敗測試 `apps/web/src/auth/MagicLinkVerifyPage.test.tsx`：URL `?token=...` 正常時導向 `/dashboard`；token 過期時顯示 `auth.errors.magicLinkExpired` 對應字串
- [x] 3.3 [P] 寫失敗測試 `apps/web/src/auth/RouteGuard.test.tsx`：未登入造訪受保護路由時 redirect 到 `/login?redirect=<path>`；revoked session 同樣 redirect
- [x] 3.4 [P] 寫失敗測試 `apps/web/src/account/ProfilePage.test.tsx`：載入時用 GET profile 帶入欄位；改 name + locale 並 submit 走 PATCH；非 https image URL 顯示 `account.errors.invalidImageUrl`
- [x] 3.5 [P] 寫失敗測試 `apps/web/src/account/SessionsPage.test.tsx`：列出多筆 session 並標出 `isCurrent`；revoke 他機 session 後該列消失；revoke 當前 session 後 redirect 到 `/login`
- [x] 3.6 [P] 寫失敗測試 `apps/web/src/account/DeleteAccountDialog.test.tsx`：confirm email 不符不允許按 submit；符合時 submit 呼叫 DELETE /api/account 並導向 `/login`

## 4. Implementation — Server（讓 §2 測試轉綠）

- [ ] 4.1 實作 `apps/api/src/email/mailpit.ts` 的 `MailpitEmailService` — nodemailer SMTP transport（host/port/from from env），實作 `EmailService.send`；export factory `createMailpitEmailService(env)`
- [ ] 4.2 實作 `apps/api/src/email/templates/magic-link.tsx` — React Email 元件 `<MagicLinkEmail url={...} />`，輸出 `{ html, text }`（text 用 `render(component, { plainText: true })`）；支援 `locale` prop 切換 zh-TW / en 內文
- [ ] 4.3 實作 `apps/api/src/auth/rate-limit.ts` — `applyAuthRateLimit({ kind, ip, email? })` helper，內部消費 `apps/api/src/lib/rate-limiter.ts` 的 RateLimiter 單例；3 條 rule 鍵命名固定為 `auth:magic-link:email:<email>`、`auth:magic-link:ip:<ip>`、`auth:login:ip:<ip>`
- [ ] 4.4 實作 `apps/api/src/auth/config.ts` — better-auth instance：drizzle adapter wired 到 `getDb()`、`socialProviders.google` 帶 client id/secret、`magicLink` plugin 注入 `EmailService`（從 §4.1 來）；session cookie 屬性符合「Session cookie configuration」requirement（HttpOnly / Secure / SameSite=Lax / Path=/）
- [ ] 4.5 實作 `apps/api/src/auth/index.ts` — export better-auth handler 與 `mountAuth(server)` 函式，把 `/api/auth/*` 路徑接到 better-auth；在 magic-link send 與 login 嘗試前序套用 §4.3 rate-limit；429 回應夾 `Retry-After` header；任何失敗回 `{ error: { errorKey } }` envelope
- [ ] 4.6 實作 logger redaction：在 `apps/api/src/lib/logger.ts` 補 `redact: { paths: ['req.query.token', 'req.body.token', 'req.headers.cookie', 'req.headers.authorization'], remove: true }` 並讓 §2.11 測試轉綠
- [ ] 4.7 實作 `apps/api/src/account/routes.ts` — 註冊 `GET /api/account/profile`、`PATCH /api/account/profile`、`GET /api/account/sessions`、`DELETE /api/account/sessions/:id`；全部走 protected route guard；body 用 zod schema 驗證 name 1-80、image 限 https 或 null、locale 限 `zh-TW | en`
- [ ] 4.8 實作 `apps/api/src/account/delete-account.ts` 與註冊 `DELETE /api/account` route — 驗 `confirmEmail` 大小寫不敏感比對 `users.email`；通過後呼叫 cascade delete（依靠 §1.4 migration 中的 `ON DELETE CASCADE`）；最後 clear session cookie；任何失敗用 errorKey
- [ ] 4.9 修改 `apps/api/src/index.ts` — mount `/api/auth/*`（§4.5）與 `/api/account/*`（§4.7、§4.8）；初始化 RateLimiter 單例；確認 protected route guard middleware 套用順序

## 5. Implementation — Web（讓 §3 測試轉綠）

- [ ] 5.1 實作 `apps/web/src/auth/useAuth.ts` — TanStack Query hook 包 `GET /api/account/profile`，cache key `['auth', 'session']`；export `useAuth()` 回傳 `{ user, isLoading, isAuthenticated }`；同時讀 `users.locale` 並在初始化時呼叫 `i18n.changeLanguage(user.locale)`
- [ ] 5.2 實作 `apps/web/src/auth/RouteGuard.tsx` — 高階元件，檢查 `useAuth`，未登入或 `auth.errors.sessionRevoked` 時 `<Navigate to="/login" />` 並把當前路徑塞 `?redirect=`
- [ ] 5.3 實作 `apps/web/src/auth/LoginPage.tsx` — react-hook-form + zod 驗 email 格式；Google OAuth 按鈕（`<a href="/api/auth/google">`）；Magic Link form 提交後顯示「請至信箱收信」說明；錯誤狀態走 i18n key（`auth.errors.*`）；視覺走預覽迭代（不在 TDD 範圍）
- [ ] 5.4 實作 `apps/web/src/auth/OAuthCallbackPage.tsx` — 接 better-auth 的 callback；成功後 navigate to `/dashboard`，失敗 navigate to `/login?error=googleOauthFailed`
- [ ] 5.5 實作 `apps/web/src/auth/MagicLinkVerifyPage.tsx` — 從 search param 取 token，呼叫 `GET /api/auth/magic-link/verify?token=...`；server 已會 set cookie + redirect，這裡只 fallback 處理 error state
- [ ] 5.6 實作 `apps/web/src/account/ProfilePage.tsx` — react-hook-form 編輯 name / image（限 https URL）/ locale（select with zh-TW + en）；submit PATCH /api/account/profile；錯誤狀態用 errorKey 顯示；視覺走預覽迭代
- [ ] 5.7 實作 `apps/web/src/account/SessionsPage.tsx` — TanStack Query 拉 `GET /api/account/sessions`；列表顯示 createdAt、ipAddress、userAgent、`isCurrent` badge；每列附 revoke 按鈕呼叫 DELETE；當前 session 被 revoke 後 `useAuth.logout()` + navigate `/login`
- [ ] 5.8 實作 `apps/web/src/account/DeleteAccountDialog.tsx` — shadcn Dialog；form input `confirmEmail` 即時比對 `useAuth().user.email`（大小寫不敏感）；不符時 submit 按鈕 disabled；提交後 `DELETE /api/account` 並 navigate `/login`；視覺走預覽迭代
- [ ] 5.9 修改 `apps/web/src/router.tsx` — 註冊 `/login`、`/oauth/callback`、`/auth/verify`、`/account/profile`、`/account/sessions` 路由；用 §5.2 RouteGuard 包 `/account/*`

## 6. i18n — 兩語同步

- [ ] 6.1 [P] 在 `packages/shared/locales/zh-TW.json` 補齊 `auth.*` 與 `account.*` 兩區所有 UI 字串及 errorKey 翻譯（涵蓋 `Server-returned error keys (i18n contract)` 與 `Bilingual UI strings for auth and account` requirement 列舉的全部 key 集合）
- [ ] 6.2 [P] 在 `packages/shared/locales/en.json` 同步補齊對應英文翻譯，鍵集合與 zh-TW 完全一致
- [ ] 6.3 跑 `bun test apps/api/src/auth/error-key-contract.test.ts` 確認 §2.10 的 errorKey ↔ locale 對應測試通過

## 7. E2E — Playwright（落地驗收 happy paths）

- [ ] 7.1 寫 `e2e/auth-magic-link.spec.ts`：啟 Mailpit（docker compose up -d mailpit）→ 在 `/login` 輸 email → 後台 Mailpit API 抓最新信 → 取信內 magic link → 開該 URL → 進到 `/dashboard`；對應 spec 中 `Magic Link login request` 與 `Magic Link verification` requirement
- [ ] 7.2 [P] 寫 `e2e/auth-google-oauth.spec.ts`：用 stub Google OAuth provider（`mockttp` 或環境切換 `GOOGLE_OAUTH_TEST_MODE=1`）模擬 callback；驗證首次登入建 user row、回流登入重用 row；對應 `Google OAuth login` requirement
- [ ] 7.3 [P] 寫 `e2e/account-delete.spec.ts`：登入 → `/account/profile` → 觸發 Delete Account dialog → 輸入 confirmEmail → 提交 → 驗證 redirect 到 `/login` 且重新進入需重新登入；對應 `Delete account` requirement
- [ ] 7.4 [P] 寫 `e2e/auth-logout-and-sessions.spec.ts`：登入 → 進 `/account/sessions` → 確認自己 session 標 `isCurrent` → 開第二 browser context 再登入 → 第一 context refresh 看到第二 session → revoke 第二 session → 第二 context 重新打 API 收到 401；對應 `Logout`、`List active sessions`、`Revoke session` requirement
- [ ] 7.5 跑 `bun run test:e2e` 確認所有 E2E 通過；coverage 報告需顯示 auth + account 模組 ≥ 70%

## 8. Refactor — 對齊 design.md 決策後檢核

- [ ] 8.1 對照 design.md `Decision 1: 採用 better-auth 而非自寫 OAuth state machine`：確認程式碼僅用 better-auth 提供的 OAuth state/PKCE/nonce 機制，無自寫 state 儲存
- [ ] 8.2 對照 design.md 標題 Decision 2: 把 auth schema 放在 `packages/shared/src/db/auth-schema.ts` 而非 `apps/api/src/db/schema.ts`：跑 `grep -r "from \"./auth-schema\"" apps/api/src/db/schema.ts` 確認 re-export pattern；前端只 `import type` 不引 runtime
- [ ] 8.3 對照 design.md 標題 Decision 3: EmailService 抽成 shared interface，Mailpit impl 住在 apps/api：確認 better-auth config 接收 `EmailService` 而非具體實作；mock 替換 Resend 不需動 better-auth config
- [ ] 8.4 對照 design.md 標題 Decision 4: Rate-limit 規則三條 — Magic Link 寄信 per-email 與 per-IP，login 嘗試 per-IP：抽 §4.3 helper review，確認三條鍵命名與 design.md 一致
- [ ] 8.5 對照 `Decision 5: errorKey 對應表固定在 spec 中`：grep 全 server 程式找硬編碼的 user-facing 錯誤字串，全部替換為 errorKey
- [ ] 8.6 對照 design.md 標題 Decision 6: 帳號刪除採 cascade delete，所有 owner-only canvases 一併刪：確認 §1.4 migration 對 `sessions`、`accounts`、`verification_tokens` FK 加 `ON DELETE CASCADE`；M2 與 M5 加表時擴充 cascade
- [ ] 8.7 對照 design.md 標題 Decision 7: Session 撤回走 better-auth 的 `revokeSession(sessionId)`：確認 §4.7 sessions revoke endpoint 呼叫 better-auth 提供的 API 而非自己 delete row
- [ ] 8.8 對照 `Decision 8: New deep modules vs. shallow glue`：審視 §4 / §5 模組大小，確認 `EmailService` 維持薄 interface、shallow glue 無自寫單元測試（靠 integration / E2E 覆蓋）
- [ ] 8.9 對照 `Risks / Trade-offs` 中 logger 不能落 token 的風險：再次跑 §2.11 redaction 測試 + 手動觸發一次 magic-link send，肉眼確認 stdout 不含 token

## 9. 驗收與 Out-of-Scope Guard

- [ ] 9.1 跑 `bun test --coverage` 確認 auth + account 模組單元 + integration 覆蓋 ≥ 70%
- [ ] 9.2 跑 `bunx oxlint` 與 `bunx oxfmt --check` 全綠
- [ ] 9.3 跑 `bun run typecheck` 全綠
- [ ] 9.4 手動 review：本 change 未引入 Resend / Sentry / analytics / image cloud upload / 2FA / 密碼登入 / Apple GitHub OAuth / 全域語言切換器 UI / public-link viewer auth / 帳號合併 UI（per Non-Goals）
- [ ] 9.5 視覺預覽迭代收尾：依序開 `/login`、`/oauth/callback`（stub）、`/auth/verify`（stub）、`/account/profile`、`/account/sessions`、Delete Account dialog 給 user review；獲得 user 視覺通過後本 change 才算完成
