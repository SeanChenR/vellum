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

The system SHALL expose `PATCH /api/account/profile` accepting a JSON body containing zero or more of: `name` (string ≤ 64 chars after trim), `image` (https URL or empty string), `locale` (`zh-TW` | `en`). The endpoint SHALL update only the supplied fields, persist the change, and respond with the full updated user profile.

The ProfilePage form (`apps/web/src/account/ProfilePage.tsx`) SHALL submit only `name` and `image` in its payload; it SHALL NOT include `locale`. Locale changes from the UI SHALL be performed exclusively through the navbar `<LocaleToggle />`, which calls the same `PATCH /api/account/profile` endpoint with a `{ locale }` body. The ProfilePage form schema SHALL NOT include a `locale` field, and the form SHALL NOT render a locale select element.

#### Scenario: ProfilePage submit excludes locale

- **GIVEN** the `/account/profile` route is rendered
- **WHEN** the user edits the display name and clicks Save
- **THEN** the resulting `PATCH /api/account/profile` request body MUST contain only `{ name, image }` (no `locale` key)

#### Scenario: ProfilePage has no locale select element

- **GIVEN** the `/account/profile` route is rendered
- **THEN** the form MUST NOT render any `<select>` or `<input>` labelled with `account.profile.localeLabel`

#### Scenario: Endpoint accepts locale from navbar toggle

- **GIVEN** the user is signed in and toggles the navbar locale to `en`
- **WHEN** the client sends `PATCH /api/account/profile` with body `{ "locale": "en" }`
- **THEN** the response MUST reflect `locale: "en"` and persist the change to the database


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

---
### Requirement: ProfilePage renders the form inside an elevated card

The `/account/profile` route SHALL render the profile form inside a `<Card variant="elevated">` placed within the standard `max-w-6xl` page container. The form SHALL expose three controls: display name input, avatar URL input, and a destructive trigger that opens the delete-account dialog. The form's primary submit button SHALL use the `<Button variant="primary">` styling.

#### Scenario: Form lives inside an elevated card with consistent page container

- **GIVEN** the `/account/profile` route is rendered in a 1280 px viewport
- **THEN** the outer page container MUST be 1152 px wide (matching the navbar)
- **AND** the form MUST sit inside an element with the `<Card variant="elevated">` styling


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

---
### Requirement: SessionsPage renders each session as a card row with current-session badge

The `/account/sessions` route SHALL render every active session as its own row inside a parent `<Card>` container. The currently active session SHALL display a cyan badge with the i18n key `account.sessions.thisDeviceBadge` and SHALL be pinned to the top of the list. Each row SHALL display device label, IP, last-seen timestamp, and a destructive `Revoke` action that opens a confirmation dialog before performing the destructive call.

#### Scenario: Current session is pinned with cyan badge

- **GIVEN** the user has three active sessions including the one on the current device
- **WHEN** `/account/sessions` is rendered
- **THEN** the current session MUST appear as the first row
- **AND** the first row MUST display a `<Badge tone="cyan">` whose text is the translation of `account.sessions.thisDeviceBadge`
- **AND** the first row MUST NOT show a Revoke action

#### Scenario: Revoke requires confirmation

- **WHEN** the user clicks `Revoke` on any non-current session row
- **THEN** a confirmation dialog MUST open before the DELETE request is sent
- **AND** the DELETE request MUST only fire after the user confirms


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

---
### Requirement: ApiKeysPage groups BYOK providers and MCP tokens into two card sections

The `/account/api-keys` route SHALL render two distinct sections within a single `max-w-6xl` page container:

- Section A — Provider Keys: three rows (Anthropic, OpenAI, Google), each row using `<Card>` and containing the provider label, masked key preview, replace and delete actions, and the per-provider default model picker.
- Section B — MCP Tokens: the existing `<PatTokensSection />` rendered as a sibling `<Card>` containing the token list and the "Create token" button.

Section B SHALL sit visually below Section A separated by a 32 px gap. Both sections SHALL share the same container width and consume the same `<Card>` primitive styles.

#### Scenario: Both sections are visible on the route

- **WHEN** the `/account/api-keys` route renders for an authenticated user
- **THEN** the page MUST contain exactly one section labelled `account.apiKeys.title`
- **AND** the page MUST contain exactly one section labelled `account.pat.title`
- **AND** the second section MUST appear after the first in DOM order

#### Scenario: Create-token plaintext dialog uses cyan highlight + i18n warning

- **WHEN** the user creates a new MCP token
- **THEN** the resulting dialog MUST show the plaintext token in a region styled with `--accent-cyan-soft` background
- **AND** the warning copy MUST come from the i18n key `account.pat.plaintextWarning`
- **AND** closing the dialog MUST remove the plaintext from the DOM


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

---
### Requirement: Account settings live under a single tabbed route

The system SHALL expose account management as a single `/account` route containing a tab navigation over four panels: `profile` (個人資料), `sessions` (登入裝置), `api-keys` (API 與 MCP), and `pricing` (定價參考). The active tab SHALL be controlled by the `?tab=<id>` search parameter; the default is `profile`.

The three pre-existing routes `/account/profile`, `/account/sessions`, `/account/api-keys` SHALL be retained for backward compatibility but their component SHALL redirect (client-side) to the equivalent `/account?tab=<id>` URL.

The tab navigation SHALL satisfy WAI-ARIA tabs pattern: parent `role="tablist"`, each tab `role="tab"` with `aria-selected` and `aria-controls`, each panel `role="tabpanel"` with matching `id`. Active-tab visual state SHALL use `--accent-purple` underline.

#### Scenario: Default tab is profile

- **GIVEN** a signed-in user navigates to `/account`
- **THEN** the URL MUST become `/account?tab=profile` (or stay `/account` with profile rendered)
- **AND** the profile panel MUST be visible
- **AND** the other three panels MUST be hidden (display: none or unmounted)

#### Scenario: Legacy /account/profile redirects to tab

- **WHEN** a user navigates to `/account/profile`
- **THEN** the URL MUST be replaced with `/account?tab=profile`
- **AND** the profile panel MUST be rendered

#### Scenario: Clicking a tab updates the URL and active panel

- **GIVEN** the user is on `/account?tab=profile`
- **WHEN** the user clicks the `API 與 MCP` tab
- **THEN** the URL MUST become `/account?tab=api-keys`
- **AND** the API & MCP panel MUST be visible
- **AND** the active tab's `aria-selected` MUST equal `"true"` while the others equal `"false"`


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

---
### Requirement: Pricing tab renders BYOK pricing as provider-grouped tier cards

The Pricing tab SHALL render three `<Card variant="elevated">` cards, one per brand (Claude / OpenAI / Gemini — the consumer-facing brand for each provider's model lineup). Each card SHALL contain a `<table>` body with three rows ordered `flagship` → `balanced` → `economy`. Each row SHALL display: a tier label badge (`flagship` purple / `balanced` cyan / `economy` muted), the model identifier in `font-mono`, the input price, and the output price. The pricing data SHALL be sourced from the existing `BYOK_PRICING` constant in `@vellum/shared/byok-pricing`. The shared unit ("USD / 1M tokens") SHALL appear once in the section subtitle and SHALL NOT be repeated inside each card.

Each card SHALL render the brand PNG asset (`claude.png` / `openai.png` / `gemini.png`) as its header icon directly (no surrounding white-background wrapper, since the PNG assets are transparent). The card SHALL carry a 3 px top border in the brand color. The legacy `ApiKeysPricingTable` component MAY remain in the codebase but SHALL NOT be imported by the Pricing tab.

#### Scenario: Three provider cards rendered

- **WHEN** the Pricing tab is active
- **THEN** the panel MUST contain exactly three `<Card variant="elevated">` elements
- **AND** their headings MUST match the three provider names (Anthropic, OpenAI, Google) in that order

#### Scenario: Tier badge tones map to spec

- **GIVEN** the Pricing tab renders the Anthropic card
- **THEN** the `flagship` row MUST contain a `<Badge tone="purple">`
- **AND** the `balanced` row MUST contain a `<Badge tone="cyan">`
- **AND** the `economy` row MUST contain a `<Badge tone="muted">`


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

---
### Requirement: API & MCP tab uses row-based layout with saved-state indicator

The API & MCP tab SHALL render the three BYOK provider rows inside a single `<Card>` (NOT three separate cards). Adjacent provider rows SHALL be separated by a horizontal divider (`divide-y` on the wrapper), but each provider row SHALL NOT contain any internal horizontal dividers — the Identity / Credential / Default Model zones inside a row are separated by vertical spacing only. Each row SHALL show: the provider's brand PNG (anthropic / openai / google asset, rendered directly without a surrounding solid-background wrapper since the PNGs are transparent), provider name, masked key in `font-mono`, and replace + delete actions inline (right-aligned). When a provider key is saved, the row SHALL display a `<Badge tone="cyan" dot>` with text `已連線 / Connected`.

The PAT (MCP Tokens) list SHALL render each token as a single horizontal row: lucide `Key` icon, token name (semibold), masked prefix in `font-mono`, relative last-used time, expiration date, and a destructive ghost `Revoke` button — all on one line with appropriate gap.

The Create-token dialog plaintext reveal SHALL show the plaintext inside a region styled with `bg-accent-cyan/10` and a copy button containing a lucide `Copy` icon.

#### Scenario: Saved provider row shows cyan dot badge

- **GIVEN** the user has saved an Anthropic API key
- **WHEN** the API & MCP tab is rendered
- **THEN** the Anthropic row MUST contain a `<Badge tone="cyan" dot>` whose text matches the i18n key `account.apiKeys.savedBadge`

#### Scenario: Unsaved provider row does not show the saved badge

- **GIVEN** the user has NOT saved a Google API key
- **WHEN** the API & MCP tab is rendered
- **THEN** the Google row MUST NOT contain a `<Badge tone="cyan" dot>`

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