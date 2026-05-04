# sharing Specification

## Purpose

TBD - created by archiving change 'add-sharing'. Update Purpose after archive.

## Requirements

### Requirement: Owner invites a known user by email creates a share immediately

The system SHALL provide `POST /api/canvas/:canvasId/share/invite` accepting JSON body `{ email, role }` where `role` is `'editor' | 'viewer'`. When the supplied email matches an existing row in the `users` table, the system SHALL insert a row into `canvas_shares` with that user's id and the supplied role, return HTTP 200 with body `{ data: { kind: 'member', userId, role } }`, and SHALL NOT send an invite email. The endpoint SHALL be restricted to the canvas owner — any other authenticated user receives HTTP 403 `errors.canvas.forbidden`.

#### Scenario: Owner invites an existing user

- **WHEN** the owner POSTs `{ email: "alice@example.com", role: "editor" }` to `/api/canvas/<id>/share/invite` and a `users` row exists for that email
- **THEN** the system MUST create a row `canvas_shares(canvas_id=<id>, user_id=<alice.id>, role='editor')`
- **AND** the response status MUST be 200 with body `data.kind === 'member'`

#### Scenario: Non-owner is forbidden from inviting

- **WHEN** an authenticated user who is NOT the canvas owner POSTs to `/api/canvas/<id>/share/invite`
- **THEN** the system MUST return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`

#### Scenario: Email is normalised to lowercase before lookup

- **WHEN** the owner POSTs `{ email: "Alice@Example.COM", role: "viewer" }` and a `users` row exists for `"alice@example.com"`
- **THEN** the system MUST treat the input as `"alice@example.com"` and create the share against that user

#### Scenario: Re-inviting an existing share updates the role

- **WHEN** the owner POSTs `{ email, role: "viewer" }` and a `canvas_shares` row already exists for that email's user with role `editor`
- **THEN** the system MUST update the existing row to `role='viewer'`
- **AND** return HTTP 200 with `data.kind === 'member'`


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
### Requirement: Owner invites an unknown email creates a pending invite and sends mail

When the supplied email does NOT match any `users` row, the endpoint SHALL insert a row into `canvas_invites` with a 32-byte cryptographically random base64url token, an `expires_at` of 7 days in the future, and SHALL send a `share-invite` email through the configured email service with the accept URL `<base>/api/share/invite/<token>/accept`. The response SHALL be HTTP 200 with body `{ data: { kind: 'pending', inviteId, email, role } }`.

#### Scenario: Email to a new address creates a pending invite

- **WHEN** the owner POSTs `{ email: "new@example.com", role: "viewer" }` and no `users` row matches
- **THEN** the system MUST create a row `canvas_invites(canvas_id=<id>, email='new@example.com', role='viewer', token=<random>, expires_at=now+7d)`
- **AND** the system MUST send an email to `new@example.com` whose body contains the accept URL with the token
- **AND** the response status MUST be 200 with `data.kind === 'pending'`

#### Scenario: Re-inviting the same email replaces the pending token

- **WHEN** the owner POSTs the same email twice within the 7-day window
- **THEN** the system MUST overwrite the existing pending invite's token (regenerate) and reset `expires_at`
- **AND** the second email MUST contain the new token; the previous token MUST NOT validate any longer


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
### Requirement: Invite acceptance route requires email match and writes a share

The system SHALL provide `GET /api/share/invite/:token/accept`. When the token does not match any `canvas_invites` row or the row's `expires_at` is in the past, the system SHALL return HTTP 404. When valid but the request has no session, the system SHALL redirect to `/login?redirect=<encoded same URL>`. When the request has a session and the session user's email differs from the invite email, the system SHALL return HTTP 403. When all checks pass, the system SHALL insert into `canvas_shares`, delete the invite row, and redirect to `/canvas/:canvasId`.

#### Scenario: Logged-in invitee with matching email accepts

- **WHEN** the invitee with session user.email matching the invite's email visits the accept URL
- **THEN** the system MUST insert a `canvas_shares` row for `(canvasId, session.userId, invite.role)`
- **AND** the system MUST delete the matching `canvas_invites` row
- **AND** the response MUST be a 302 redirect to `/canvas/<canvasId>`

#### Scenario: Anonymous invitee is redirected through login

- **WHEN** an unauthenticated request visits the accept URL with a valid unexpired token
- **THEN** the response MUST be a 302 redirect whose `Location` is `/login?redirect=<accept-url-encoded>`

#### Scenario: Email mismatch is forbidden

- **WHEN** an authenticated user whose `email` differs from the invite's email visits the accept URL
- **THEN** the system MUST return HTTP 403 `errors.share.emailMismatch`
- **AND** MUST NOT create a share row or delete the invite

#### Scenario: Expired token returns 404

- **WHEN** any request visits the accept URL with a token whose row's `expires_at` is in the past
- **THEN** the system MUST return HTTP 404 `errors.share.inviteExpired`


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
### Requirement: Owner reads share state for a canvas

The system SHALL provide `GET /api/canvas/:canvasId/share` returning a JSON envelope with the canvas owner, current accepted shares (`members`), pending email invites (`invites`), and the public link record (`link` — null if none exists yet, or `{ token, mode, rotatedAt }`). The endpoint SHALL be restricted to the canvas owner.

#### Scenario: Owner reads a fresh canvas share state

- **WHEN** the owner GETs `/api/canvas/<id>/share` for a canvas with no shares, no invites, and no link record
- **THEN** the response MUST be 200 with `data: { ownerId, members: [], invites: [], link: null }`

#### Scenario: Owner reads a canvas with mixed members and invites

- **GIVEN** the canvas has 2 accepted shares and 1 pending invite, and `canvas_share_links.mode = 'view'`
- **WHEN** the owner GETs `/api/canvas/<id>/share`
- **THEN** the response MUST include `members.length === 2`, `invites.length === 1`, `link.mode === 'view'`


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
### Requirement: Owner changes a member's role

The system SHALL provide `PATCH /api/canvas/:canvasId/share/members/:userId` with body `{ role: 'editor' | 'viewer' }`. On success the endpoint SHALL update the matching `canvas_shares` row, return HTTP 200, and call the sync server's revocation hook with `scope: { kind: 'user', userId }` so any active WebSocket sessions for that user reconnect under the new role.

#### Scenario: Role change persists and triggers revocation

- **WHEN** the owner PATCHes `{ role: 'viewer' }` for a member previously stored as `editor`
- **THEN** the `canvas_shares` row MUST be updated to `role='viewer'`
- **AND** the sync revocation hook MUST be invoked for that `(canvasId, userId)`


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
### Requirement: Owner removes a share

The system SHALL provide `DELETE /api/canvas/:canvasId/share/members/:userId`. On success the endpoint SHALL delete the matching `canvas_shares` row, return HTTP 204, and call the sync server's revocation hook with `scope: { kind: 'user', userId }`.

#### Scenario: Removing a member kicks active sessions

- **WHEN** the owner DELETEs `/api/canvas/<id>/share/members/<userId>`
- **THEN** the matching `canvas_shares` row MUST be deleted
- **AND** any active WebSocket connection bearing that user's session MUST be closed by the sync server with code 4403


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
### Requirement: Owner revokes a pending invite

The system SHALL provide `DELETE /api/canvas/:canvasId/share/invites/:inviteId`. On success the endpoint SHALL delete the matching `canvas_invites` row and return HTTP 204. Subsequent requests to `/api/share/invite/:token/accept` with the deleted invite's token MUST return HTTP 404.

#### Scenario: Revoking an invite invalidates the accept link

- **WHEN** the owner DELETEs `/api/canvas/<id>/share/invites/<inviteId>` and an unauthenticated request later GETs `/api/share/invite/<token>/accept`
- **THEN** the accept-URL response MUST be HTTP 404 `errors.share.inviteExpired`


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
### Requirement: Owner toggles the public link mode

The system SHALL provide `PUT /api/canvas/:canvasId/share/link` with body `{ mode: 'closed' | 'view' | 'edit' }`. On the first call for a canvas the endpoint SHALL lazy-create the `canvas_share_links` row with a fresh random token. Subsequent calls SHALL update the `mode` column without changing the token. When the new mode is `'closed'`, the endpoint SHALL also call the sync server's revocation hook with `scope: { kind: 'all-anonymous' }` so anonymous WebSocket sessions for that canvas are closed.

#### Scenario: First mode toggle creates the link record

- **WHEN** the owner PUTs `{ mode: 'view' }` for a canvas with no `canvas_share_links` row
- **THEN** the system MUST insert a row with a freshly generated token, `mode='view'`, and `rotated_at=now()`
- **AND** subsequent GETs of `/share` MUST report `link.token` of that value

#### Scenario: Setting mode to closed kicks anonymous sessions

- **WHEN** the owner PUTs `{ mode: 'closed' }` while two anonymous WebSocket connections are open against the canvas via the public link
- **THEN** both connections MUST be closed by the sync server with code 4403
- **AND** the `canvas_share_links.mode` MUST be `'closed'`


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
### Requirement: Owner rotates the public link token

The system SHALL provide `POST /api/canvas/:canvasId/share/link/rotate`. On success the endpoint SHALL replace `canvas_share_links.token` with a fresh 32-byte base64url random value, update `rotated_at = now()`, return HTTP 200 with the new token, and call the sync revocation hook with `scope: { kind: 'all-anonymous' }`. Any subsequent WebSocket handshake bearing the previous token SHALL be rejected with HTTP 403.

#### Scenario: Rotation invalidates the previous token

- **GIVEN** an anonymous visitor is currently connected with token `T1`
- **WHEN** the owner POSTs `/api/canvas/<id>/share/link/rotate`
- **THEN** the visitor's WebSocket MUST be closed with code 4403
- **AND** any new handshake using `T1` as `?token=` query MUST be rejected with HTTP 403
- **AND** the response body MUST contain `data.token === <new-token>`


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
### Requirement: Sharing endpoints enforce per-owner rate limits

The system SHALL apply per-user rate limits to the sharing endpoints: `POST /share/invite` at 10 requests per 60 seconds per user; `POST /share/link/rotate` at 5 requests per 60 seconds per user. When exceeded the system SHALL return HTTP 429 `errors.rateLimit` with a `Retry-After` header.

#### Scenario: Eleventh invite within 60 seconds is rate-limited

- **WHEN** the owner sends 11 successful invite POSTs to the same canvas within a 60-second window
- **THEN** the 11th response MUST be HTTP 429 with body `{ error: "errors.rateLimit", retryAfter: <seconds> }`


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
### Requirement: ShareDialog opens from the TopBar Share button

The web client SHALL render a `ShareDialog` modal in place of the existing placeholder Share toast. The dialog SHALL contain three sections: "Invite by email" (email + role inputs and a Send button), "Members" (list of accepted shares + pending invites with per-row role select and remove control), and "Public link" (radio buttons for `closed | view | edit`, a copy-link button, and a rotate button). All strings SHALL be localized via `t('canvas.share.*')` keys present in both `zh-TW` and `en` locale files.

#### Scenario: Clicking Share opens the dialog

- **WHEN** an authenticated owner viewing `/canvas/<id>` clicks the Share button in the TopBar
- **THEN** a modal dialog MUST appear with the three labelled sections
- **AND** the previously-rendered placeholder toast MUST NOT appear

#### Scenario: Member list reflects API state

- **GIVEN** the API returns `members.length === 2` and `invites.length === 1`
- **WHEN** the dialog renders
- **THEN** the Members section MUST show 3 rows total (2 marked as accepted members and 1 marked as pending)


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
### Requirement: Anonymous visitors enter via public link without login redirect

The web client SHALL accept URLs of the form `/canvas/:canvasId?share=<token>` for unauthenticated visitors and SHALL render the canvas without redirecting to `/login`. The sync hook SHALL pass the token to the WebSocket handshake; the chrome SHALL hide the user menu, the Sign-out action, and the Share button; and the TopBar SHALL display an "Anonymous {animal}" label using the per-tab tldraw-assigned animal name.

#### Scenario: Anonymous visit with valid view-mode link

- **GIVEN** the canvas's `canvas_share_links.mode === 'view'`
- **WHEN** an unauthenticated browser navigates to `/canvas/<id>?share=<token>`
- **THEN** the page MUST NOT redirect to `/login`
- **AND** the canvas MUST mount with `isReadonly=true`
- **AND** the TopBar MUST NOT render the user menu or the Share button

#### Scenario: Anonymous visit without a token still redirects to login

- **WHEN** an unauthenticated browser navigates to `/canvas/<id>` with no `share` query parameter
- **THEN** the page MUST redirect to `/login?redirect=<encoded original URL>`

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