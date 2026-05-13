# auth Specification

## Purpose

TBD - created by archiving change 'add-auth'. Update Purpose after archive.

## Requirements

### Requirement: Google OAuth login

The system SHALL allow visitors to sign in via Google OAuth. The OAuth flow MUST follow the authorization code grant with PKCE, validate `state` and `nonce` against the originating session, and create a Vellum `users` row on first successful authentication. Subsequent sign-ins for the same Google account MUST reuse the existing user row.

#### Scenario: First-time Google sign-in creates user

- **WHEN** a visitor with no existing Vellum account completes the Google OAuth flow successfully
- **THEN** the system creates a `users` row populated from the Google profile (`email`, `name`, `image`), creates a `sessions` row, sets the `session` cookie (HttpOnly, Secure, SameSite=Lax), and redirects the client to `/dashboard`

#### Scenario: Returning Google user reuses existing account

- **WHEN** a user whose Google email matches an existing `users.email` completes the Google OAuth flow
- **THEN** the system reuses the existing `users` row, creates a new `sessions` row, sets the cookie, and redirects to `/dashboard`

#### Scenario: Google OAuth state mismatch is rejected

- **WHEN** the OAuth callback `state` parameter does not match the value stored at flow initiation
- **THEN** the system responds with HTTP 400 and an envelope `{ error: { errorKey: "auth.errors.googleOauthFailed" } }` and does NOT create a session

#### Scenario: Google OAuth provider error is surfaced

- **WHEN** Google returns an error response (`error=access_denied` or any non-2xx) at the callback
- **THEN** the system responds with HTTP 400 and `errorKey: "auth.errors.googleOauthFailed"` without creating a session or user


<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Magic Link login request

The system SHALL accept Magic Link sign-in requests at `POST /api/auth/magic-link/send` with `{ email }`. On valid input, the system MUST generate a cryptographically random single-use token, persist it with an expiration of 15 minutes, and dispatch an email containing the verification URL via the configured `EmailService`. The endpoint MUST enforce two rate-limit rules: per-email 3 requests per 10 minutes, and per-IP 10 requests per hour.

#### Scenario: Valid email sends magic link

- **WHEN** a client posts `{ "email": "user@example.com" }` to `POST /api/auth/magic-link/send` and rate-limit windows have capacity
- **THEN** the system persists a `verification_tokens` row with a 15-minute expiry, calls `EmailService.send` with the magic-link URL, and responds with HTTP 200 and `{ data: { sent: true } }`

#### Scenario: Per-email rate limit blocks 4th send within 10 minutes

- **WHEN** the same email address has already received 3 magic-link sends in the past 10 minutes
- **THEN** the system responds with HTTP 429, `{ error: { errorKey: "auth.errors.emailRateLimited" } }`, and a `Retry-After` header carrying the seconds remaining until a token frees

##### Example: per-email window

| Send sequence | Outcome |
| ------------- | ------- |
| Send 1 (T=0s) | 200 OK, token sent |
| Send 2 (T=10s) | 200 OK, token sent |
| Send 3 (T=20s) | 200 OK, token sent |
| Send 4 (T=30s) | 429, `Retry-After` ≈ 570s |
| Send 5 (T=600s+) | 200 OK, window has refilled |

#### Scenario: Per-IP rate limit blocks 11th send within an hour

- **WHEN** the same client IP has issued 10 magic-link sends across any combination of email addresses in the past hour
- **THEN** the system responds with HTTP 429 and `{ error: { errorKey: "auth.errors.ipRateLimited" } }` with a `Retry-After` header

#### Scenario: Invalid email format is rejected before rate-limit consumption

- **WHEN** a client posts `{ "email": "not-an-email" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.invalidEmail" } }` and does NOT consume rate-limit tokens

#### Scenario: Magic link token is not logged

- **WHEN** the magic-link send endpoint is invoked
- **THEN** the structured logger MUST NOT include the generated token, the email body, or the `Authorization`/`Cookie` headers in any log line


<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Magic Link verification

The system SHALL verify magic-link tokens at `GET /api/auth/magic-link/verify?token=<token>`. On successful verification, the system MUST create a `users` row for new emails (or reuse the existing one), create a `sessions` row, mark the token as used, set the session cookie, and redirect to `/dashboard`. Tokens MUST be single-use and MUST be rejected after their 15-minute expiry. The endpoint MUST enforce a per-IP rate limit of 10 attempts per minute.

#### Scenario: Valid unused token authenticates the user

- **WHEN** a client opens `GET /api/auth/magic-link/verify?token=<valid-unused-token-within-expiry>`
- **THEN** the system creates or reuses the `users` row, creates a session, marks the token as used, sets the session cookie, and responds with HTTP 302 to `/dashboard`

#### Scenario: Expired token is rejected

- **WHEN** a client opens the verify URL with a token whose `expires_at` is in the past
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.magicLinkExpired" } }` without creating a session

#### Scenario: Already-used token is rejected

- **WHEN** a client opens the verify URL with a token whose `used_at` is non-null
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.invalidCredentials" } }` without creating a session

#### Scenario: Unknown token is rejected

- **WHEN** a client opens the verify URL with a token that has no matching `verification_tokens` row
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.invalidCredentials" } }`

#### Scenario: Per-IP verify rate limit blocks 11th attempt within a minute

- **WHEN** the same IP has made 10 verify attempts in the past 60 seconds
- **THEN** the system responds with HTTP 429, `{ error: { errorKey: "auth.errors.ipRateLimited" } }`, and a `Retry-After` header


<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Logout

The system SHALL terminate the current session at `POST /api/auth/logout`. The endpoint MUST delete the `sessions` row identified by the request cookie, clear the `session` cookie via `Set-Cookie` with `Max-Age=0`, and respond with HTTP 200.

#### Scenario: Logout clears session and cookie

- **WHEN** an authenticated client posts to `POST /api/auth/logout`
- **THEN** the system deletes the `sessions` row, returns `Set-Cookie: session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, and responds `{ data: { ok: true } }`

#### Scenario: Logout without session is idempotent

- **WHEN** an unauthenticated client posts to `POST /api/auth/logout`
- **THEN** the system responds with HTTP 200 and `{ data: { ok: true } }` without error and emits a `Set-Cookie` header clearing the cookie


<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Session cookie configuration

The system SHALL set the session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/` attributes. The cookie value MUST be the session id; the value MUST NOT include the user id, email, or any verification token.

#### Scenario: Cookie attributes are present on every login response

- **WHEN** any login endpoint (`/api/auth/google/callback`, `/api/auth/magic-link/verify`) creates a session
- **THEN** the response `Set-Cookie` header includes `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`


<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Protected route guard

The system SHALL reject access to `/api/account/*` and any other authenticated endpoints when no valid session cookie is present. The web application SHALL redirect unauthenticated visitors of `/dashboard`, `/canvas/*`, `/account/*`, and any other protected client routes to `/login`.

#### Scenario: API request without session is rejected

- **WHEN** a client without a session cookie sends a request to `GET /api/account/profile`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "auth.errors.notAuthenticated" } }`

#### Scenario: API request with revoked session is rejected

- **WHEN** a client whose `sessions` row has been deleted or whose `revoked_at` is set sends a request to `GET /api/account/profile`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "auth.errors.sessionRevoked" } }`

#### Scenario: Web app redirects unauthenticated user to login

- **WHEN** an unauthenticated client navigates to `/dashboard` in the web application
- **THEN** the application redirects to `/login` and preserves the original target as a `?redirect=<path>` search parameter


<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Server-returned error keys (i18n contract)

The system SHALL return failure responses with the envelope `{ error: { errorKey: <string> } }` where `errorKey` is an i18next dot-notation key. The system MUST NOT return localized human-readable error strings on the API surface.

#### Scenario: Failure response uses errorKey

- **WHEN** any auth endpoint returns a non-2xx response
- **THEN** the response body matches the schema `{ error: { errorKey: string, details?: object } }` and the `errorKey` value resolves to a key present in BOTH `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`

##### Example: errorKey set required by this spec

| errorKey | When raised |
| -------- | ----------- |
| auth.errors.invalidEmail | Magic-link send with malformed email |
| auth.errors.invalidCredentials | Unknown or used magic-link token |
| auth.errors.magicLinkExpired | Magic-link token past 15-minute expiry |
| auth.errors.googleOauthFailed | Google OAuth state mismatch or provider error |
| auth.errors.emailRateLimited | Per-email magic-link send window exceeded |
| auth.errors.ipRateLimited | Per-IP magic-link send or login attempt window exceeded |
| auth.errors.notAuthenticated | Protected endpoint without session cookie |
| auth.errors.sessionRevoked | Protected endpoint with deleted/revoked session |
| auth.errors.magicLinkSendFailed | EmailService throws while sending magic link |

<!-- @trace
source: add-auth
updated: 2026-04-30
code:
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/auth/config.ts
  - package.json
  - apps/api/tsconfig.json
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/assets.d.ts
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/email/mailpit.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/api/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - playwright.config.ts
  - apps/api/.env.example
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - scripts/dev-proxy.ts
  - scripts/dev.ts
  - apps/web/src/chrome/index.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/account/routes.ts
  - apps/api/src/index.ts
  - packages/shared/src/email/types.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - docker-compose.yml
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/router.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/auth/useAuth.ts
  - packages/shared/src/shape-types.ts
  - packages/shared/src/index.ts
  - apps/web/src/assets/vellum-logo.png
  - apps/web/src/index.html
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/auth/route-guard.ts
  - docs/screenshots/.gitkeep
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/styles.css
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/canvas/index.ts
  - asset/vellum-logo-removebg.png
  - apps/api/src/folder/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - docs/screenshots/add-canvas-editor-shell/.gitkeep
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - .spectra.yaml
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/main.tsx
  - apps/web/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/canvas/persistence.ts
  - apps/web/src/components/FolderCreateDialog.tsx
  - packages/shared/package.json
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/LoginPage.tsx
  - bun.lock
  - apps/api/src/db/schema.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/lib/permission.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - docs/screenshots/README.md
  - apps/api/drizzle/meta/0001_snapshot.json
tests:
  - e2e/auth-magic-link.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/api-contract.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/router.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - e2e/account-delete.spec.ts
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/account/sessions.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
-->

---
### Requirement: Authentication pages render centered card layouts using shared primitives

The `/login`, `/auth/verify`, and `/invite-error` routes SHALL each render a single centered `<Card variant="elevated">` containing their respective content. The card SHALL be vertically and horizontally centered within the viewport between the navbar and footer, with a maximum width of 420 px. The card border, surface, and text color SHALL resolve through Aura theme tokens and adapt automatically to the active theme.

#### Scenario: LoginPage centers an elevated card

- **GIVEN** the `/login` route is rendered in a 1280 × 800 viewport
- **THEN** the page MUST contain exactly one `<Card variant="elevated">` element with a maximum rendered width of 420 px
- **AND** the card MUST be centered both horizontally and vertically within the available viewport space (excluding the navbar and footer)

#### Scenario: LoginPage shows email + Google sign-in separated by a divider

- **GIVEN** the `/login` route is rendered
- **THEN** the card MUST contain a magic-link email input field above an "or" divider above a "Sign in with Google" button
- **AND** the magic-link submit button MUST use the `<Button variant="primary">` styling

#### Scenario: MagicLinkVerifyPage shows a Mail icon above its status copy

- **GIVEN** the `/auth/verify` route is rendered
- **THEN** the card MUST display a lucide `Mail` icon at 32 px above the status message
- **AND** the icon MUST resolve its color through `--accent-purple`

#### Scenario: InviteErrorPage uses orange accent for the warning state

- **GIVEN** the `/invite-error` route is rendered
- **THEN** the card MUST display the warning icon and headline colored via `--accent-orange`
- **AND** the body copy MUST resolve through `--text-muted`

<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
-->