# account Specification

## Purpose

TBD - created by archiving change 'add-auth'. Update Purpose after archive.

## Requirements

### Requirement: Read profile

The system SHALL provide `GET /api/account/profile` to return the authenticated user's profile fields. The response MUST include `id`, `email`, `name`, `image`, `locale`, and `createdAt`. The endpoint MUST require an authenticated session.

#### Scenario: Authenticated user fetches profile

- **WHEN** an authenticated client sends `GET /api/account/profile`
- **THEN** the system responds with HTTP 200 and `{ data: { id, email, name, image, locale, createdAt } }` populated from the `users` row of the session subject

#### Scenario: Unauthenticated request is rejected

- **WHEN** a client without a valid session sends `GET /api/account/profile`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "auth.errors.notAuthenticated" } }`


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
### Requirement: Update profile

The system SHALL provide `PATCH /api/account/profile` to update the authenticated user's `name`, `image`, and `locale`. The body MUST be validated: `name` is a non-empty string of length 1–80, `image` is either an absolute `https://` URL or `null`, and `locale` is one of `zh-TW` or `en`. The system MUST NOT accept changes to `email` or `id`.

#### Scenario: Valid name update succeeds

- **WHEN** an authenticated client sends `PATCH /api/account/profile` with `{ "name": "新顯示名" }`
- **THEN** the system updates the `users.name` column for the session subject and responds with HTTP 200 and the updated profile

#### Scenario: Image URL must be absolute https

- **WHEN** an authenticated client sends `PATCH /api/account/profile` with `{ "image": "http://example.com/a.png" }` (non-https) or `{ "image": "/relative.png" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "account.errors.invalidImageUrl" } }` and does NOT update the row

#### Scenario: Locale change is persisted

- **WHEN** an authenticated client sends `PATCH /api/account/profile` with `{ "locale": "en" }`
- **THEN** the system updates `users.locale` to `en` and the next `GET /api/account/profile` returns `locale: "en"`

#### Scenario: Unsupported locale is rejected

- **WHEN** an authenticated client sends `PATCH /api/account/profile` with `{ "locale": "ja" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "account.errors.unsupportedLocale" } }` and does NOT update the row

#### Scenario: Email field cannot be patched

- **WHEN** an authenticated client sends `PATCH /api/account/profile` with `{ "email": "evil@example.com" }`
- **THEN** the system ignores the `email` field, the `users.email` column remains unchanged, and the response reflects the original email


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
### Requirement: List active sessions

The system SHALL provide `GET /api/account/sessions` to return all non-revoked sessions belonging to the authenticated user. The response MUST include for each session: `id`, `createdAt`, `lastSeenAt`, `ipAddress`, `userAgent`, and `isCurrent` (boolean indicating whether this session matches the request's session cookie).

#### Scenario: Sessions list returns the user's own sessions only

- **WHEN** an authenticated client sends `GET /api/account/sessions`
- **THEN** the response body is `{ data: { sessions: Session[] } }` containing only sessions where `userId` matches the requester, and `isCurrent` is `true` for exactly one entry

#### Scenario: Revoked sessions are excluded

- **WHEN** the user's `sessions` table contains rows with non-null `revoked_at`
- **THEN** those rows MUST NOT appear in the response


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
### Requirement: Revoke session

The system SHALL provide `DELETE /api/account/sessions/:id` to revoke a session by id. The endpoint MUST verify the target session belongs to the authenticated user and reject revoke attempts on other users' sessions with HTTP 404. If the revoked session is the current session, the response MUST include a `Set-Cookie` header that clears the session cookie.

#### Scenario: Revoke another device session

- **WHEN** an authenticated client sends `DELETE /api/account/sessions/<other-session-id>` for a session belonging to the same user
- **THEN** the system marks `sessions.revoked_at` for that row, responds with HTTP 200 and `{ data: { ok: true } }`, and the next `GET /api/account/sessions` excludes the revoked entry

#### Scenario: Revoke current session clears cookie

- **WHEN** an authenticated client sends `DELETE /api/account/sessions/<current-session-id>`
- **THEN** the system marks the row revoked, responds with HTTP 200, and the response includes `Set-Cookie: session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax`

#### Scenario: Revoke another user's session is hidden

- **WHEN** an authenticated client sends `DELETE /api/account/sessions/<id-not-owned-by-requester>`
- **THEN** the system responds with HTTP 404 and `{ error: { errorKey: "account.errors.sessionNotFound" } }` without revealing that the id exists


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
### Requirement: Delete account

The system SHALL provide `DELETE /api/account` to permanently delete the authenticated user. The request body MUST include `{ confirmEmail: string }`; the system MUST reject the request unless `confirmEmail` exactly matches the authenticated user's `users.email` (case-insensitive). On confirmation, the system MUST cascade-delete the user's `sessions`, `accounts`, `verification_tokens` for that email, and (in later changes) `canvases`, `folders`, `canvas_shares` rows where the user is owner or member. After deletion, the system MUST clear the session cookie and respond with HTTP 200.

#### Scenario: Confirmed delete removes account and cascades

- **WHEN** an authenticated client sends `DELETE /api/account` with `{ "confirmEmail": "<exact-user-email>" }`
- **THEN** the system deletes the `users` row (cascading to `sessions`, `accounts`, `verification_tokens` for that email), clears the session cookie, and responds with HTTP 200 and `{ data: { ok: true } }`

#### Scenario: Mismatched confirm email is rejected

- **WHEN** an authenticated client sends `DELETE /api/account` with `{ "confirmEmail": "wrong@example.com" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "account.errors.confirmEmailMismatch" } }` and the `users` row is NOT deleted

#### Scenario: Confirm email comparison is case-insensitive

- **WHEN** the authenticated user's email is `User@Example.com` and the request body is `{ "confirmEmail": "user@example.com" }`
- **THEN** the system accepts the confirmation and proceeds with deletion

#### Scenario: Unauthenticated delete is rejected

- **WHEN** a client without a session cookie sends `DELETE /api/account`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "auth.errors.notAuthenticated" } }`


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
### Requirement: Bilingual UI strings for auth and account

The web application SHALL render every auth and account UI string through `t('<key>')`. Every key referenced by the auth or account UI MUST be present in BOTH `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`. The application MUST NOT contain hardcoded display strings in JSX for any auth or account view.

#### Scenario: Locale files contain matched key sets

- **WHEN** the build extracts every `t('...')` key referenced under `apps/web/src/auth/**` and `apps/web/src/account/**`
- **THEN** every extracted key resolves successfully against `packages/shared/locales/zh-TW.json` AND against `packages/shared/locales/en.json`

#### Scenario: Active locale comes from user record on login

- **WHEN** a user with `users.locale = "en"` signs in and the application loads any auth or account page
- **THEN** the i18next instance is initialized with `lng: "en"` (sourced from the profile API response) before the first render of localized content

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