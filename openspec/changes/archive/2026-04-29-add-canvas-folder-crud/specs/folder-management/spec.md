## ADDED Requirements

### Requirement: Folder creation

The system SHALL provide an authenticated REST endpoint `POST /api/folder` that creates a folder owned by the current authenticated user. Folders are flat: the schema SHALL NOT support a `parent_id` column and the system SHALL NOT permit nesting folders inside folders.

#### Scenario: Successful folder creation

- **WHEN** an authenticated user POSTs to `/api/folder` with body `{ name: "Sketches" }`
- **THEN** the system SHALL return HTTP 201 with body `{ data: { id, ownerId, name: "Sketches", createdAt, updatedAt } }`
- **AND** a row SHALL exist in the `folders` table with `owner_id` equal to the authenticated user's id

#### Scenario: Name length validation

- **WHEN** an authenticated user POSTs to `/api/folder` with `name` longer than 80 characters or empty
- **THEN** the system SHALL return HTTP 400 with body `{ error: "errors.validation", details: <ZodIssue[]> }`

#### Scenario: Unauthenticated request

- **WHEN** an unauthenticated request POSTs to `/api/folder`
- **THEN** the system SHALL return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`

#### Scenario: Rate limit exceeded

- **WHEN** an authenticated user issues an 11th `POST /api/folder` within a 60 second window
- **THEN** the system SHALL return HTTP 429 with body `{ error: "errors.rateLimit", retryAfter: <seconds> }`
- **AND** the response SHALL include the `Retry-After` header

### Requirement: Folder list query

The system SHALL provide `GET /api/folder` returning all folders owned by the current authenticated user.

#### Scenario: List returns owned folders

- **WHEN** an authenticated user GETs `/api/folder`
- **THEN** the system SHALL return HTTP 200 with body `{ data: <Folder[]>, meta: { total: <n> } }` containing only folders where `owner_id` equals the user's id
- **AND** entries SHALL be sorted by `name` ascending

##### Example: alphabetical ordering

- **GIVEN** the user owns three folders: `{name: "Zeta"}`, `{name: "Alpha"}`, `{name: "Mike"}`
- **WHEN** the user GETs `/api/folder`
- **THEN** `data` SHALL be `[Alpha, Mike, Zeta]`

#### Scenario: Unauthenticated list request

- **WHEN** an unauthenticated request GETs `/api/folder`
- **THEN** the system SHALL return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`

### Requirement: Folder rename

The system SHALL provide `PATCH /api/folder/:id` that updates the folder `name`. The folder MUST be owned by the authenticated user.

#### Scenario: Owner renames folder

- **WHEN** an authenticated user PATCHes `/api/folder/<own-folder-id>` with body `{ name: "Renamed" }`
- **THEN** the system SHALL return HTTP 200 with `data.name === "Renamed"` and a refreshed `updatedAt`

#### Scenario: Non-owner attempts to rename

- **WHEN** an authenticated user PATCHes `/api/folder/<other-user-folder-id>`
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.folder.forbidden" }`
- **AND** the row SHALL remain unchanged

#### Scenario: Folder does not exist

- **WHEN** an authenticated user PATCHes `/api/folder/<random-uuid>` where no row exists
- **THEN** the system SHALL return HTTP 404 with body `{ error: "errors.folder.notFound" }`

#### Scenario: Validation failure

- **WHEN** an authenticated user PATCHes `/api/folder/:id` with body `{ name: "" }`
- **THEN** the system SHALL return HTTP 400 with body `{ error: "errors.validation", details: <ZodIssue[]> }`

### Requirement: Folder delete with non-empty guard

The system SHALL provide `DELETE /api/folder/:id` that removes the folder. If the folder still contains canvases, the request SHALL fail and the row SHALL remain. The user MUST first reassign or delete the contained canvases.

#### Scenario: Owner deletes empty folder

- **WHEN** an authenticated user DELETEs `/api/folder/<own-empty-folder-id>`
- **THEN** the system SHALL return HTTP 204 with no body
- **AND** the row SHALL be removed from the `folders` table

#### Scenario: Owner attempts to delete non-empty folder

- **WHEN** an authenticated user DELETEs `/api/folder/<own-folder-id>` where one or more canvases reference that folder
- **THEN** the system SHALL return HTTP 409 with body `{ error: "errors.folder.notEmpty" }`
- **AND** the folder row SHALL remain in the `folders` table
- **AND** none of the contained canvases SHALL be modified

#### Scenario: Non-owner attempts to delete

- **WHEN** an authenticated user DELETEs `/api/folder/<other-user-folder-id>`
- **THEN** the system SHALL return HTTP 403 with body `{ error: "errors.folder.forbidden" }`

#### Scenario: Folder does not exist

- **WHEN** an authenticated user DELETEs `/api/folder/<random-uuid>` where no row exists
- **THEN** the system SHALL return HTTP 404 with body `{ error: "errors.folder.notFound" }`

### Requirement: Folder schema enforces 1-level depth

The Drizzle schema SHALL define the `folders` table without any self-referential foreign key. The `canvases.folder_id` column SHALL be nullable and reference `folders.id` with `ON DELETE SET NULL`. The system SHALL NOT support folders nested inside folders.

#### Scenario: Schema lacks parent_id column

- **WHEN** the migration produced from the Drizzle schema is inspected
- **THEN** the generated `CREATE TABLE folders` statement SHALL NOT include a `parent_id` column

#### Scenario: Canvas folder reference uses SET NULL

- **WHEN** a folder row is deleted directly at the database level (bypassing the application guard)
- **THEN** every canvas that referenced the deleted folder SHALL have its `folder_id` set to NULL
- **AND** the canvases SHALL remain in the `canvases` table

### Requirement: Folder tree component renders flat list with drag targets

The web frontend SHALL provide a `FolderTree` component rendered in the dashboard sidebar that displays one row per folder owned by the user, plus a synthetic "All canvases" entry and a synthetic "Unfiled" entry. Each folder row SHALL be a drop target that accepts canvas card drags. The component SHALL NOT render nested folder rows.

#### Scenario: Tree renders one row per folder

- **WHEN** `FolderTree` is rendered with three folders `[A, B, C]`
- **THEN** the component SHALL render exactly five rows in order: "All canvases", "Unfiled", A, B, C

#### Scenario: Drop a canvas card onto a folder row

- **WHEN** the user drags a `CanvasCard` and drops it onto a folder row
- **THEN** the component SHALL invoke `PATCH /api/canvas/:id` with body `{ folderId: <folder-id> }`
- **AND** on success the canvas SHALL appear under the destination folder on the next list refresh

#### Scenario: Drop a canvas card onto "Unfiled"

- **WHEN** the user drags a `CanvasCard` and drops it onto the "Unfiled" row
- **THEN** the component SHALL invoke `PATCH /api/canvas/:id` with body `{ folderId: null }`

#### Scenario: Selecting a folder filters the canvas list

- **WHEN** the user clicks a folder row
- **THEN** the dashboard SHALL re-query `GET /api/canvas?folderId=<folder-id>` and render only canvases under that folder

### Requirement: Localized strings for folder UI synchronized across zh-TW and en

Every UI string introduced by the folder tree, folder dialogs, and folder-related errorKeys SHALL be present with the same key in both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`.

#### Scenario: Both locales contain folder UI keys

- **WHEN** the locale files are loaded
- **THEN** both `zh-TW.json` and `en.json` SHALL contain the keys `folder.allCanvases`, `folder.unfiled`, `folder.create`, `folder.rename`, `folder.delete`, `folder.deleteConfirm`

#### Scenario: Both locales contain folder error keys

- **WHEN** the locale files are loaded
- **THEN** both `zh-TW.json` and `en.json` SHALL contain the keys `errors.folder.notFound`, `errors.folder.forbidden`, `errors.folder.notEmpty`
