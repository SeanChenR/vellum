# canvas-management Specification

## Purpose

TBD - created by archiving change 'add-canvas-folder-crud'. Update Purpose after archive.

## Requirements

### Requirement: Canvas creation

The system SHALL provide an authenticated REST endpoint that creates a canvas owned by the current authenticated user. The created canvas SHALL persist `id`, `owner_id`, `folder_id` (nullable), `title`, `snapshot` (defaulting to an empty JSON object), `created_at`, and `updated_at`.

#### Scenario: Successful creation outside any folder

- **WHEN** an authenticated user POSTs to `/api/canvas` with body `{ title: "My Canvas" }`
- **THEN** the system SHALL return HTTP 201 with body `{ data: { id, ownerId, folderId: null, title: "My Canvas", snapshot: {}, createdAt, updatedAt } }`
- **AND** a row SHALL exist in the `canvases` table with `owner_id` equal to the authenticated user's id

#### Scenario: Successful creation inside a folder owned by the same user

- **WHEN** an authenticated user POSTs to `/api/canvas` with body `{ title: "Inside Folder", folderId: "<own-folder-id>" }`
- **THEN** the system SHALL return HTTP 201 with `data.folderId` equal to the supplied folder id

#### Scenario: Creating a canvas inside a folder the user does not own

- **WHEN** an authenticated user POSTs to `/api/canvas` with `folderId` referencing a folder owned by a different user
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.folder.forbidden" }`
- **AND** no row SHALL be inserted into the `canvases` table

#### Scenario: Title length validation

- **WHEN** an authenticated user POSTs to `/api/canvas` with a `title` longer than 120 characters or empty
- **THEN** the system SHALL return HTTP 400 with body `{ error: "errors.validation", details: <ZodIssue[]> }`

#### Scenario: Unauthenticated request

- **WHEN** an unauthenticated request POSTs to `/api/canvas`
- **THEN** the system SHALL return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`

#### Scenario: Rate limit exceeded

- **WHEN** an authenticated user issues an 11th `POST /api/canvas` within a 60 second window
- **THEN** the system SHALL return HTTP 429 with body `{ error: "errors.rateLimit", retryAfter: <seconds> }`
- **AND** the response SHALL include the `Retry-After` header


<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->

---
### Requirement: Canvas list query with scope filter

The system SHALL provide an authenticated REST endpoint `GET /api/canvas` that returns canvases visible to the current user. The endpoint SHALL accept a `scope` query parameter taking one of `owned` (default) or `shared`. Owned scope SHALL return canvases where `owner_id` equals the user. Shared scope SHALL return canvases for which the user has a row in `canvas_shares`, joined to `canvases` to materialize the same DTO shape as owned-scope results. Both scopes SHALL be sorted by `updated_at` descending.

#### Scenario: Default scope returns owned canvases sorted by recency

- **WHEN** an authenticated user GETs `/api/canvas`
- **THEN** the system SHALL return HTTP 200 with body `{ data: <Canvas[]>, meta: { total: <n> } }`
- **AND** entries SHALL include only canvases where `owner_id` equals the user's id
- **AND** entries SHALL be sorted by `updated_at` descending

##### Example: ordering by updated_at

- **GIVEN** the user owns three canvases: A(updatedAt=2026-04-29T10:00Z), B(updatedAt=2026-04-29T12:00Z), C(updatedAt=2026-04-29T08:00Z)
- **WHEN** the user GETs `/api/canvas`
- **THEN** `data` SHALL be `[B, A, C]`

#### Scenario: Folder filter

- **WHEN** an authenticated user GETs `/api/canvas?folderId=<own-folder-id>`
- **THEN** the system SHALL return only canvases whose `folder_id` matches the supplied folder id
- **AND** the supplied folder MUST be owned by the user, otherwise the system SHALL return HTTP 403 `{ error: "errors.folder.forbidden" }`

#### Scenario: Unfiled filter

- **WHEN** an authenticated user GETs `/api/canvas?folderId=null`
- **THEN** the system SHALL return only canvases whose `folder_id` is NULL and `owner_id` matches the user

#### Scenario: Shared scope returns canvases joined through canvas_shares

- **GIVEN** the user has 2 rows in `canvas_shares` referencing 2 different canvases owned by other users
- **WHEN** the user GETs `/api/canvas?scope=shared`
- **THEN** the system SHALL return HTTP 200 with body `{ data: <Canvas[]>, meta: { total: 2 } }`
- **AND** entries SHALL contain those 2 canvases, sorted by `updated_at` descending

#### Scenario: Shared scope excludes canvases the user owns

- **GIVEN** the user owns canvas A and is also a shared editor on canvas A (an unusual but possible state)
- **WHEN** the user GETs `/api/canvas?scope=shared`
- **THEN** canvas A MUST NOT appear in the result; shared scope returns only canvases the user does NOT own

#### Scenario: Unauthenticated list request

- **WHEN** an unauthenticated request GETs `/api/canvas`
- **THEN** the system SHALL return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`


<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: Canvas read by id

The system SHALL provide `GET /api/canvas/:id` that returns the full canvas record including `snapshot`. Access SHALL be granted only when `canAccess(user, canvas, 'read')` returns true.

#### Scenario: Owner reads own canvas

- **WHEN** an authenticated user GETs `/api/canvas/<own-canvas-id>`
- **THEN** the system SHALL return HTTP 200 with body `{ data: { id, ownerId, folderId, title, snapshot, createdAt, updatedAt } }`

#### Scenario: Non-owner attempts to read

- **WHEN** an authenticated user GETs `/api/canvas/<other-user-canvas-id>` and is not the owner
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`

#### Scenario: Canvas does not exist

- **WHEN** an authenticated user GETs `/api/canvas/<random-uuid>` where no row exists
- **THEN** the system SHALL return HTTP 404 with body `{ error: "errors.canvas.notFound" }`


<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->

---
### Requirement: Canvas update (rename and folder reassignment)

The system SHALL provide `PATCH /api/canvas/:id` accepting partial updates of `title` (1-120 chars) and `folderId` (uuid or null). On any update the system SHALL set `updated_at` to the current time. Access SHALL require `canAccess(user, canvas, 'write') === true`.

#### Scenario: Owner renames own canvas

- **WHEN** an authenticated user PATCHes `/api/canvas/<own-canvas-id>` with body `{ title: "Renamed" }`
- **THEN** the system SHALL return HTTP 200 with `data.title === "Renamed"` and a new `updatedAt`

#### Scenario: Owner moves canvas into own folder

- **WHEN** an authenticated user PATCHes `/api/canvas/<own-canvas-id>` with body `{ folderId: "<own-folder-id>" }`
- **THEN** the system SHALL return HTTP 200 with `data.folderId` equal to the supplied folder id

#### Scenario: Owner moves canvas out of any folder

- **WHEN** an authenticated user PATCHes `/api/canvas/<own-canvas-id>` with body `{ folderId: null }`
- **THEN** the system SHALL return HTTP 200 with `data.folderId === null`

#### Scenario: Moving canvas into a folder owned by another user

- **WHEN** an authenticated user PATCHes their own canvas with `folderId` pointing at another user's folder
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.folder.forbidden" }`
- **AND** the canvas row SHALL NOT be modified

#### Scenario: Non-owner attempts to update

- **WHEN** an authenticated user PATCHes `/api/canvas/<other-user-canvas-id>`
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`

#### Scenario: Validation failure

- **WHEN** an authenticated user PATCHes `/api/canvas/:id` with body `{ title: "" }`
- **THEN** the system SHALL return HTTP 400 with body `{ error: "errors.validation", details: <ZodIssue[]> }`


<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->

---
### Requirement: Canvas delete

The system SHALL provide `DELETE /api/canvas/:id` that permanently removes the canvas. Access SHALL require `canAccess(user, canvas, 'delete') === true`.

#### Scenario: Owner deletes own canvas

- **WHEN** an authenticated user DELETEs `/api/canvas/<own-canvas-id>`
- **THEN** the system SHALL return HTTP 204 with no body
- **AND** the row SHALL be removed from the `canvases` table

#### Scenario: Non-owner attempts to delete

- **WHEN** an authenticated user DELETEs `/api/canvas/<other-user-canvas-id>`
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`
- **AND** the row SHALL remain intact

#### Scenario: Deleting non-existent canvas

- **WHEN** an authenticated user DELETEs `/api/canvas/<random-uuid>` where no row exists
- **THEN** the system SHALL return HTTP 404 with body `{ error: "errors.canvas.notFound" }`


<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->

---
### Requirement: Permission contract for canvas actions

The system SHALL expose a deep module function `canAccess(user, canvas, action, ctx?)` from `apps/api/src/lib/permission.ts` that returns a boolean for each action in `'read' | 'write' | 'delete' | 'share'`. The optional `ctx` argument carries the user's relationship to the canvas as resolved from the database by the caller: `sharedRole` (`'editor' | 'viewer' | null`) and `publicLinkMode` (`'closed' | 'view' | 'edit' | null`). The function SHALL combine ownership, share-row presence, and public-link mode into the access decision matrix below.

| Identity | read | write | delete | share |
| -------- | ---- | ----- | ------ | ----- |
| owner (user.id === canvas.ownerId) | ✓ | ✓ | ✓ | ✓ |
| shared editor (`ctx.sharedRole === 'editor'`) | ✓ | ✓ | | |
| shared viewer (`ctx.sharedRole === 'viewer'`) | ✓ | | | |
| public-link-edit (`ctx.publicLinkMode === 'edit'`) | ✓ | ✓ | | |
| public-link-view (`ctx.publicLinkMode === 'view'`) | ✓ | | | |
| anyone else (including `user === null` without public link) | | | | |

The function SHALL accept `user === null` so it can be called for anonymous requests bearing only a public-link token.

#### Scenario: Owner check returns true for all actions

- **WHEN** `canAccess(user, canvas, action)` is called with `user.id === canvas.ownerId`
- **THEN** the function SHALL return true for `action` in `['read', 'write', 'delete', 'share']`

#### Scenario: Shared editor can read and write but not delete or share

- **WHEN** `canAccess({ id: 'u-x' }, canvas, action, { sharedRole: 'editor' })` is called with `canvas.ownerId !== 'u-x'`
- **THEN** the function SHALL return true for `action` in `['read', 'write']` and false for `['delete', 'share']`

#### Scenario: Shared viewer can read only

- **WHEN** `canAccess({ id: 'u-y' }, canvas, action, { sharedRole: 'viewer' })` is called with `canvas.ownerId !== 'u-y'`
- **THEN** the function SHALL return true for `action === 'read'` and false for every other supported action

#### Scenario: Public link in edit mode grants read+write to anonymous users

- **WHEN** `canAccess(null, canvas, action, { publicLinkMode: 'edit' })` is called
- **THEN** the function SHALL return true for `action` in `['read', 'write']` and false for `['delete', 'share']`

#### Scenario: Public link in view mode grants read only

- **WHEN** `canAccess(null, canvas, action, { publicLinkMode: 'view' })` is called
- **THEN** the function SHALL return true for `action === 'read'` and false for every other supported action

#### Scenario: Public link in closed mode grants nothing

- **WHEN** `canAccess(null, canvas, action, { publicLinkMode: 'closed' })` is called
- **THEN** the function SHALL return false for every supported action

#### Scenario: Anonymous user without public link context returns false

- **WHEN** `canAccess(null, canvas, action)` is called with no `ctx` (or `ctx` containing no `publicLinkMode`)
- **THEN** the function SHALL return false for every supported action

##### Example: full decision matrix

| user | sharedRole | publicLinkMode | read | write | delete | share |
| ---- | ---------- | -------------- | ---- | ----- | ------ | ----- |
| owner | (n/a) | (n/a) | true | true | true | true |
| non-owner | editor | (n/a) | true | true | false | false |
| non-owner | viewer | (n/a) | true | false | false | false |
| null | (n/a) | edit | true | true | false | false |
| null | (n/a) | view | true | false | false | false |
| null | (n/a) | closed | false | false | false | false |
| non-owner | null | null | false | false | false | false |


<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: Dashboard canvas list view

The web frontend SHALL render a `/dashboard` route that displays two sections: "My Canvases" listing canvases returned by `GET /api/canvas?scope=owned` and "Shared with me" listing canvases returned by `GET /api/canvas?scope=shared`. The route SHALL require authentication and redirect unauthenticated visitors to the login route.

#### Scenario: Authenticated user opens dashboard

- **WHEN** an authenticated user navigates to `/dashboard`
- **THEN** the page SHALL render an "My Canvases" heading and a "Shared with me" heading
- **AND** each section SHALL render one `CanvasCard` per canvas returned by its respective query

#### Scenario: Empty owned section

- **WHEN** an authenticated user opens `/dashboard` and owns zero canvases
- **THEN** the "My Canvases" section SHALL render an empty state with a localized prompt to create the first canvas

#### Scenario: Empty shared section

- **WHEN** an authenticated user opens `/dashboard` and `GET /api/canvas?scope=shared` returns an empty array
- **THEN** the "Shared with me" section SHALL render an empty state with a localized message

#### Scenario: Unauthenticated visitor

- **WHEN** an unauthenticated visitor navigates to `/dashboard`
- **THEN** the router SHALL redirect to the login route


<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->

---
### Requirement: Canvas card displays metadata

The `CanvasCard` component SHALL display the canvas title, the localized last-edited time, and a placeholder thumbnail. Clicking the card SHALL navigate to the canvas detail route owned by `add-canvas-editor-shell`. A context menu on the card SHALL expose "Rename", "Move", and "Delete" actions.

#### Scenario: Card renders metadata

- **WHEN** `CanvasCard` is rendered with a canvas record where `title="Demo"` and `updatedAt="2026-04-29T10:00:00Z"`
- **THEN** the card SHALL render the text "Demo"
- **AND** the card SHALL render a localized relative time string for `updatedAt`

#### Scenario: Card opens rename dialog from context menu

- **WHEN** the user opens the card's context menu and selects "Rename"
- **THEN** a rename dialog SHALL appear with the current title pre-filled

#### Scenario: Card opens delete confirmation from context menu

- **WHEN** the user opens the card's context menu and selects "Delete"
- **THEN** a delete confirmation dialog SHALL appear and SHALL NOT call `DELETE /api/canvas/:id` until the user confirms


<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->

---
### Requirement: Localized strings synchronized across zh-TW and en

Every UI string introduced by the dashboard, canvas card, canvas dialogs, and canvas-related errorKeys SHALL be present with the same key in both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`. The two locale files SHALL share an identical key set.

#### Scenario: Both locales contain dashboard heading keys

- **WHEN** the locale files are loaded
- **THEN** both `zh-TW.json` and `en.json` SHALL contain the keys `dashboard.myCanvases`, `dashboard.sharedWithMe`, `dashboard.createCanvas`, `dashboard.empty.owned`, `dashboard.empty.shared`

#### Scenario: Both locales contain canvas error keys

- **WHEN** the locale files are loaded
- **THEN** both `zh-TW.json` and `en.json` SHALL contain the keys `errors.canvas.notFound`, `errors.canvas.forbidden`, `errors.auth.unauthorized`, `errors.validation`, `errors.rateLimit`

<!-- @trace
source: add-canvas-folder-crud
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasCreateDialog.tsx
  - scripts/dev.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/package.json
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/dashboard/useFolderList.ts
  - apps/api/src/auth/index.ts
  - apps/web/src/main.tsx
  - packages/shared/src/shape-types.ts
  - package.json
  - apps/web/src/components/CanvasCard.tsx
  - apps/api/.env.example
  - packages/shared/src/db/auth-schema.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/src/lib/logger.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/src/db/schema.ts
  - apps/web/src/chrome/MainMenu.tsx
  - packages/shared/src/index.ts
  - apps/web/src/router.tsx
  - apps/api/src/folder/index.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - apps/api/src/auth/config.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/api/src/index.ts
  - docker-compose.yml
  - apps/web/src/account/SessionsPage.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - apps/web/src/canvas/persistence.ts
  - apps/api/src/email/mailpit.ts
  - apps/web/src/chrome/index.tsx
  - packages/shared/package.json
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/canvas/Editor.tsx
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/useAuth.ts
  - scripts/dev-proxy.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/lib/permission.ts
  - apps/api/package.json
  - apps/web/src/canvas/useCanvasQuery.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/api/src/account/delete-account-validator.ts
tests:
  - apps/api/src/folder/folder.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/email/mailpit.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/api/src/auth/error-key-contract.test.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/api/src/account/profile.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/magic-link.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - e2e/account-delete.spec.ts
  - e2e/auth-google-oauth.spec.ts
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/auth-logout-and-sessions.spec.ts
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/canvas/persistence.test.ts
  - apps/api/src/canvas/canvas.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/router.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
-->