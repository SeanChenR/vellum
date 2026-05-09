## ADDED Requirements

### Requirement: Folder handler not-found path is unit-testable without DB access

The unit tests covering `handleFolderRequest`'s 404 path (rename / delete of a non-existent folder id) SHALL exercise the handler with an injected `folderDeps` whose loader returns `null`, never relying on the production `getDb()` fallback. This isolates the 404 assertion from DB infrastructure so `bun test` from the repo root works on a clean checkout.

#### Scenario: PATCH /api/folder/:id rename with non-existent id returns 404 in unit test

- **GIVEN** a `folderDeps` whose `loadFolder` returns `null` for any id
- **WHEN** the test calls `handleFolderRequest(PATCH req with body, session, rateLimiter, folderDeps)` with a randomly generated folder id
- **THEN** the response status MUST be 404 with body `{"error":"errors.folder.notFound"}`
- **AND** the test SHALL NOT call `getDb()` and SHALL NOT depend on `Bun.env.DATABASE_URL`

#### Scenario: DELETE /api/folder/:id with non-existent id returns 404 in unit test

- **GIVEN** a `folderDeps` whose `loadFolder` returns `null`
- **WHEN** the test calls `handleFolderRequest(DELETE req, session, rateLimiter, folderDeps)` with a non-existent id
- **THEN** the response status MUST be 404 with body `{"error":"errors.folder.notFound"}`
- **AND** no DB connection MUST be attempted
