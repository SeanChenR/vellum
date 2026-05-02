## MODIFIED Requirements

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
