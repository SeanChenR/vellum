## ADDED Requirements

### Requirement: Canvas handler not-found path is unit-testable without DB access

The unit tests covering `handleCanvasRequest`'s 404 path (read / update / delete of a non-existent canvas id) SHALL exercise the handler with an injected `canvasDeps` whose loader returns `null`, never relying on the production `getDb()` fallback. This isolates the 404 assertion from DB infrastructure (env vars, network, Postgres availability) so `bun test` from the repo root works on a clean checkout.

#### Scenario: GET /api/canvas/:id with a non-existent id returns 404 in unit test

- **GIVEN** a `canvasDeps` whose `loadCanvas` returns `null` for any id
- **WHEN** the test calls `handleCanvasRequest(GET req, session, rateLimiter, canvasDeps)` with a randomly generated canvas id
- **THEN** the response status MUST be 404 with body `{"error":"errors.canvas.notFound"}`
- **AND** the test SHALL NOT call `getDb()` and SHALL NOT depend on `Bun.env.DATABASE_URL`

#### Scenario: PATCH /api/canvas/:id with a non-existent id returns 404 in unit test

- **GIVEN** a `canvasDeps` whose `loadCanvas` returns `null`
- **WHEN** the test calls `handleCanvasRequest(PATCH req with body, session, rateLimiter, canvasDeps)` with a non-existent id
- **THEN** the response status MUST be 404 with body `{"error":"errors.canvas.notFound"}`
- **AND** no DB connection MUST be attempted

#### Scenario: DELETE /api/canvas/:id with a non-existent id returns 404 in unit test

- **GIVEN** a `canvasDeps` whose `loadCanvas` returns `null`
- **WHEN** the test calls `handleCanvasRequest(DELETE req, session, rateLimiter, canvasDeps)` with a non-existent id
- **THEN** the response status MUST be 404 with body `{"error":"errors.canvas.notFound"}`
- **AND** no DB connection MUST be attempted
