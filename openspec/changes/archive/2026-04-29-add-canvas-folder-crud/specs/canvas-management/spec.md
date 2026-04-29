## ADDED Requirements

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

### Requirement: Canvas list query with scope filter

The system SHALL provide an authenticated REST endpoint `GET /api/canvas` that returns canvases visible to the current user. The endpoint SHALL accept a `scope` query parameter taking one of `owned` (default) or `shared`. Owned scope SHALL return canvases where `owner_id` equals the user. Shared scope SHALL return canvases shared to the user; the resolution path is owned by the `add-sharing` capability and SHALL return an empty array until that capability is implemented.

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

#### Scenario: Shared scope short-circuits to empty array in phase 1

- **WHEN** an authenticated user GETs `/api/canvas?scope=shared`
- **THEN** the system SHALL return HTTP 200 with body `{ data: [], meta: { total: 0 } }` until the `add-sharing` capability is implemented

#### Scenario: Unauthenticated list request

- **WHEN** an unauthenticated request GETs `/api/canvas`
- **THEN** the system SHALL return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`

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

### Requirement: Permission contract for canvas actions

The system SHALL expose a deep module function `canAccess(user, canvas, action)` from `apps/api/src/lib/permission.ts` that returns a boolean for each action in `'read' | 'write' | 'delete' | 'share'`. In phase 1 the function SHALL return true if and only if `user` is non-null and `user.id === canvas.ownerId`. The function signature SHALL remain stable across subsequent capabilities so that the `add-sharing` capability can extend the rule set without changing call sites.

#### Scenario: Owner check returns true for all actions

- **WHEN** `canAccess(user, canvas, action)` is called with `user.id === canvas.ownerId`
- **THEN** the function SHALL return true for `action` in `['read', 'write', 'delete', 'share']`

#### Scenario: Non-owner check returns false

- **WHEN** `canAccess(user, canvas, action)` is called with `user.id !== canvas.ownerId`
- **THEN** the function SHALL return false for every supported action

#### Scenario: Anonymous user check returns false

- **WHEN** `canAccess(null, canvas, action)` is called
- **THEN** the function SHALL return false for every supported action

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

### Requirement: Localized strings synchronized across zh-TW and en

Every UI string introduced by the dashboard, canvas card, canvas dialogs, and canvas-related errorKeys SHALL be present with the same key in both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`. The two locale files SHALL share an identical key set.

#### Scenario: Both locales contain dashboard heading keys

- **WHEN** the locale files are loaded
- **THEN** both `zh-TW.json` and `en.json` SHALL contain the keys `dashboard.myCanvases`, `dashboard.sharedWithMe`, `dashboard.createCanvas`, `dashboard.empty.owned`, `dashboard.empty.shared`

#### Scenario: Both locales contain canvas error keys

- **WHEN** the locale files are loaded
- **THEN** both `zh-TW.json` and `en.json` SHALL contain the keys `errors.canvas.notFound`, `errors.canvas.forbidden`, `errors.auth.unauthorized`, `errors.validation`, `errors.rateLimit`
