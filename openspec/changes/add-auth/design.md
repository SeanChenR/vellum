## Context

Vellum 採 single-binary 架構：`apps/api` 的 `Bun.serve` 同時處理 HTTP、WebSocket、靜態前端。Auth 模組是 Phase 1 的第一個落地縱切段（M1），其後所有具備擁有者語意的模組（M2 Canvas、M3 Folder、M5 Sharing、M6 Sync）都會讀 `users.id` 與 session cookie 做授權判斷，因此 auth 設計需要把後續 12 個模組會依賴的決策一次先固定下來。

現況檔案：
- `apps/api/src/db/index.ts` 已經建好 lazy-init Drizzle client，走 Bun.SQL adapter（`drizzle-orm/bun-sql`）。
- `apps/api/src/db/schema.ts` 是空的（`export {}`），等待 M1 的四張表落地。
- `apps/api/src/lib/rate-limiter.ts` 已有 `RateLimiter` deep module（in-process token bucket + LRU），具備 `RateLimitResult` 形狀回傳 `retryAfterSeconds`。本 change 直接消費，不需新增 deep module。
- `apps/api/.env.example` 已預留 `BETTER_AUTH_SECRET`、`GOOGLE_*`、`SMTP_*` 變數但未填內容。
- `packages/shared/locales/{zh-TW,en}.json` 預期已存在或在本 change 同步建立。

外部依賴（已在 `apps/api/package.json` 範圍內預期 / 待安裝）：
- `better-auth`（核心 auth handler、Google OAuth provider、Magic Link plugin、Drizzle adapter）
- `@react-email/components` 與 `react-email`（Magic Link email template 渲染）
- `nodemailer`（Mailpit 走 SMTP；Bun 目前無原生 SMTP client，nodemailer 是務實選擇 — 一旦 Bun.SMTP 上線可替換）

## Goals / Non-Goals

**Goals:**

- 提供 Google OAuth + Magic Link 兩條登入路徑，session 用 cookie 持久化（HttpOnly / Secure / SameSite=Lax）。
- 把 better-auth 的四張標準表（`users`、`sessions`、`accounts`、`verification_tokens`）放在 `packages/shared/src/db/auth-schema.ts`，並在 `users` 額外加 `locale` 欄位（值 `zh-TW` | `en`，default `zh-TW`，constraint check）。
- 把 EmailService 抽成 interface（`packages/shared/src/email/types.ts` 的 `EmailService` type），讓 Mailpit impl 與 Phase 2 的 Resend impl 可以替換而不動 Magic Link plugin。
- Magic Link 寄信走兩條 rate-limit rule：per-email 3/10min、per-IP 10/hr；login 嘗試（OAuth callback + Magic Link verify）走 per-IP 10/min；超限 429 + `Retry-After`。
- Server 失敗回應一律 `{ error: { errorKey: "auth.errors.<x>" } }`，不回翻譯後字串；前端 i18next 查 key 後顯示。
- 個人資料頁可改 `name`、`image`、`locale`；session 頁列出當前 user 所有 active session 並可單筆撤回；刪除帳號需輸入自己的 email 確認。
- E2E 測試覆蓋兩條登入 flow（Magic Link end-to-end with Mailpit、Google OAuth with stub provider）以及刪除帳號 flow。

**Non-Goals:**

- 不做匿名訪客 / public-link viewer 的 session — 該屬 `add-sharing` 的 `share-link-token` 機制。
- 不做密碼登入 / 2FA / Apple OAuth / GitHub OAuth — Phase 1 僅 Google OAuth + Magic Link。
- 不做頭像 cloud upload — Profile 頁的頭像欄位接受外部 URL；無檔案上傳元件。
- 不做全域語言切換器 UI — 僅持久化 `users.locale` 並在 ProfilePage 提供 select；top-bar 切換器留給 `add-final-pass`。
- 不做帳號合併 UI — 同 email 的 OAuth+Magic Link 由 better-auth 預設視為同 user；不做合併確認對話框。
- 不寄真信 — Mailpit only；Resend 屬 Phase 2 deploy checklist。
- 不做 invite-on-signup（從 share email 連結註冊後自動加入該 canvas 的成員）— 該 flow 屬 `add-sharing`。

## Decisions

### Decision 1: 採用 better-auth 而非自寫 OAuth state machine

**Choice**: `better-auth@latest` + `@better-auth/drizzle-adapter`，掛在 `/api/auth/*`；Magic Link 走 better-auth 的官方 `magicLink` plugin；Google OAuth 走官方 `socialProviders.google` 設定。

**Rationale**:
- 自寫 OAuth state / PKCE / nonce 的攻擊面太大，且不是本專案的差異化點。
- better-auth 直接出 Drizzle adapter，schema 由它定義，避免我們手寫 `accounts` 表與 token rotation。
- Magic Link plugin 自帶 `sendMagicLink(email, url)` callback hook，正好掛我們的 `EmailService` interface。

**Alternatives**: 自寫（拒絕：攻擊面）、`auth.js` aka next-auth（拒絕：和 React Router 整合不順、bundle 較肥）、`lucia-auth`（已 deprecated 不維護）。

### Decision 2: 把 auth schema 放在 `packages/shared/src/db/auth-schema.ts` 而非 `apps/api/src/db/schema.ts`

**Choice**: schema 定義住在 `packages/shared`，由 `apps/api/src/db/schema.ts` re-export；前端不引用 schema runtime，但可 import 推導出的 TypeScript type（如 `User`、`Session`）做 props 與 react-query 的 cache type。

**Rationale**:
- Phase 2 的 worker 程序（若有 cron / CLI）也會需要 auth schema；放在 shared 可以避免前端跨 boundary import api package。
- 與後續 `add-canvas-folder-crud` 的 `canvases`、`folders` schema 一致放在 shared。

**Alternatives**: 全部放 `apps/api/src/db/schema.ts`（拒絕：前端 type 重複定義）、放 `apps/api` 並讓前端 `import type` 跨 workspace（拒絕：違反 boundary）。

### Decision 3: EmailService 抽成 shared interface，Mailpit impl 住在 apps/api

**Choice**: `packages/shared/src/email/types.ts` export 出 `EmailService` interface（method `send({ to, subject, html, text })`、return `Promise<void>`）；`apps/api/src/email/mailpit.ts` 用 nodemailer + SMTP transport 實作；better-auth 的 `magicLink.sendMagicLink` callback 注入這個 service。

**Rationale**:
- Phase 2 換 Resend 時只需新增 `apps/api/src/email/resend.ts` 並改 wire-up，不動 better-auth config，不動 template renderer。
- Template 用 React Email 渲染，輸出 `{ html, text }` 兩種 part；text 從 React Email 的 `render(component, { plainText: true })` 取得。
- Bun 目前無原生 SMTP client，nodemailer 為務實短期選擇；列入 deploy checklist 的「Bun.SMTP 上線後評估替換」項。

**Alternatives**: 直接在 better-auth callback 內 inline 呼叫 SMTP（拒絕：Phase 2 換 provider 要動 better-auth config）、用 Bun.write + 第三方 webhook（拒絕：不符 Mailpit dev workflow）。

### Decision 4: Rate-limit 規則三條 — Magic Link 寄信 per-email 與 per-IP，login 嘗試 per-IP

**Choice**: 重用既有 `RateLimiter`（單例 in-process）。鍵命名：
- `auth:magic-link:email:${email.toLowerCase()}` → `{ windowMs: 10 * 60_000, max: 3 }`
- `auth:magic-link:ip:${clientIp}` → `{ windowMs: 60 * 60_000, max: 10 }`
- `auth:login:ip:${clientIp}` → `{ windowMs: 60_000, max: 10 }`

clientIp 來源優先序：`x-forwarded-for` 第一段（dev 反代 / Mailpit 路徑都不會用到）→ socket remote address。Magic Link 寄信路徑兩條 rule 都檢查，任一拒絕即拒絕；429 回應夾 `Retry-After: <seconds>` header（取兩條 rule 中較大者）。`auth.errors.rateLimitExceeded` 為回應 errorKey。

**Rationale**:
- per-email 防發垃圾信攻擊個人；per-IP 防同一攻擊者輪迴 email。
- login per-IP 防 OAuth state 碰撞 / Magic Link verify 暴力。
- 重用既有 deep module 而非新增 — RateLimiter 是 shallow glue 的目標客戶。

**Alternatives**: 只 per-IP（拒絕：share IP 環境如咖啡廳會誤殺）、只 per-email（拒絕：放任 IP-side abuse）、Redis-backed（拒絕：Phase 1 single instance；列入 deploy checklist）。

### Decision 5: errorKey 對應表固定在 spec 中

**Choice**: 所有 auth 失敗回應走以下 errorKey 集合（前端 zh-TW + en 必須齊備）：
- `auth.errors.invalidCredentials` — OAuth state mismatch / Magic Link token 過期或已用
- `auth.errors.emailRateLimited` — per-email 寄信節流
- `auth.errors.ipRateLimited` — per-IP 寄信或 login 節流
- `auth.errors.googleOauthFailed` — Google 端錯
- `auth.errors.magicLinkExpired` — token 過期（明確區分於 invalidCredentials 的「不存在」）
- `auth.errors.notAuthenticated` — 受保護端點無 session
- `auth.errors.sessionRevoked` — session 已被撤回
- `account.errors.cannotDeleteOnlyOwner` — 帳號刪除前若為某 canvas 的唯一 owner（Phase 1 由 cascade delete 處理；保留 errorKey 以備未來 transfer-ownership）

**Rationale**: 集中宣告避免後續 PR 再加 errorKey 漏 zh-TW/en；analyzer 也能對 spec 與 locale JSON 兩邊比對。

**Alternatives**: 每個 endpoint 自己定 key（拒絕：難維護）、回 HTTP status + 標準 message（拒絕：不能在 UI 上顯示有意義字串）。

### Decision 6: 帳號刪除採 cascade delete，所有 owner-only canvases 一併刪

**Choice**: `users` row 刪除時，cascade 至 `sessions`、`accounts`、`canvases`（owner_id FK）、`folders`（owner_id FK）、`canvas_shares`（user_id FK）。前端流程要求輸入自己的 email 一字不差作為 confirm。

**Rationale**:
- Phase 1 PRD US #8 明定「永久刪除帳號連同所有資料」。
- 「不能離開自己的 canvas」這個 invariant 在「刪帳號」場景由 cascade 解決（不是 transfer）。
- 多 owner / transfer ownership 不在 Phase 1 — 若 Phase 2 要加，errorKey `account.errors.cannotDeleteOnlyOwner` 已預留。

**Alternatives**: soft delete（拒絕：違反「行使資料權」語意）、強制 transfer（拒絕：Phase 1 沒 transfer UI）。

### Decision 7: Session 撤回走 better-auth 的 `revokeSession(sessionId)`

**Choice**: `/api/account/sessions` 列表回傳當前 user 所有 sessions（id、createdAt、ipAddress、userAgent、isCurrent）；DELETE `/api/account/sessions/:id` 呼叫 better-auth 的 revoke API；若刪除的是當前 session，前端清 cookie 並導向 `/login`。

**Rationale**: 重用 better-auth 已實作的 session lifecycle，避免重寫 session store。

### Decision 8: New deep modules vs. shallow glue

**New deep modules (純函式 / 易測試 / 自帶單元測試)**:
- `packages/shared/src/email/types.ts` 的 `EmailService` interface — 不是 deep module 是 abstraction；標記為 interface-only。
- `apps/api/src/auth/rate-limit.ts` 的 `applyAuthRateLimit(key, ip, email?)` helper — 把三條 rule 編排成一個進入點；薄到不需要單元測試（直接走 integration）。

**Shallow glue（不需單元測試，靠 integration test 覆蓋）**:
- `apps/api/src/auth/index.ts` — better-auth instance 設定 + Drizzle adapter wire-up。
- `apps/api/src/email/mailpit.ts` — nodemailer transport wire-up；只做 SMTP transport 設定，無邏輯。
- `apps/api/src/email/templates/magic-link.tsx` — React Email 元件；視覺走預覽。
- 全部前端頁面（LoginPage、ProfilePage 等）視覺走預覽，互動行為走 component test。

**重用既有 deep modules**:
- `apps/api/src/lib/rate-limiter.ts` 的 `RateLimiter`。
- `apps/api/src/lib/logger.ts` 的 `logger`。

## Risks / Trade-offs

- **[Risk] better-auth API 仍在演進，0.x 版本可能 breaking change** → Mitigation: 在 deploy checklist 加「升級 better-auth 前執行完整 auth e2e」項；pinning 到具體 minor version。
- **[Risk] nodemailer 是非 Bun-native 依賴，違反軟性 Bun-native 偏好** → Mitigation: 用 interface 包裝，Bun.SMTP 上線後可替換；deploy checklist 已記入。
- **[Risk] Magic Link token 若被 logger 洩漏會等同密碼外洩** → Mitigation: pino 設 redact path（`req.query.token`、`req.body.token`、`req.headers.cookie`）；spec 明文要求 logger 不能落 token。
- **[Risk] cascade delete 把使用者 own 的 shared canvas 一起刪，可能影響 collaborator** → Mitigation: 刪除確認 dialog 文案明示「會連同所有 owned canvas」；errorKey `account.errors.cannotDeleteOnlyOwner` 預留 Phase 2 transfer-ownership flow。
- **[Risk] Rate-limit per-IP 在 NAT / proxy 下會誤殺整辦公室** → Mitigation: 接受（Phase 1 自用為主）；deploy checklist 記入「上線後監測 429 比例」。
- **[Risk] Google OAuth client secret 寫在 .env，git ignore 但易意外 commit** → Mitigation: `.env.example` 只放空字串註解；pre-commit hook（已存在）配 secret scan。
- **[Risk] Magic Link 的 SMTP 沒寄出（Mailpit 沒開）會默默失敗** → Mitigation: `MailpitEmailService.send` 失敗 throw，better-auth callback 不吞 error；前端顯示 `auth.errors.magicLinkSendFailed`；同時 logger error log 帶 SMTP 訊息。

