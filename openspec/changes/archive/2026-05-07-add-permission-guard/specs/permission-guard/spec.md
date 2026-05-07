## ADDED Requirements

### Requirement: Permission Guard gates write-side AI surfaces by canvas role

The system SHALL provide a server-side Permission Guard module that gates write-side AI surfaces. The module SHALL expose `requireRole(deps, session, canvasId, allowed)`, where `deps` injects `resolveCanvasRole(userId, canvasId): Promise<{ canvasExists: boolean; role: CanvasRole | null }>`, `session` is `{ userId: string } | null`, `canvasId` is a string, and `allowed` is a non-empty list of `CanvasRole` values. The function SHALL return a discriminated result `{ ok: true } | { ok: false, status: 401 | 403 | 404, errorKey: string }`. Callers (HTTP route handlers) SHALL invoke `requireRole` before dispatching any canvas-mutating operation and SHALL translate `{ ok: false, status, errorKey }` directly into an HTTP response of `status` with body `{ ok: false, errorKey }`.

The guard SHALL apply the following decision matrix in order, returning at the first matching row:

| Step | Condition | Result |
| ---- | --------- | ------ |
| 1 | `session === null` | `{ ok: false, status: 401, errorKey: "errors.auth.unauthorized" }` |
| 2 | `resolveCanvasRole(...).canvasExists === false` | `{ ok: false, status: 404, errorKey: "errors.canvas.notFound" }` |
| 3 | `resolveCanvasRole(...).role === null` | `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }` |
| 4 | `role` is NOT in `allowed` | `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }` |
| 5 | `role` is in `allowed` | `{ ok: true }` |

The guard SHALL NOT introduce new error keys; it MUST reuse `errors.auth.unauthorized`, `errors.canvas.notFound`, and `errors.canvas.forbidden` as already declared in the shared API contract. The guard SHALL NOT resolve sessions, parse cookies, or read public-link tokens — those concerns belong to the calling endpoint's session middleware. The guard SHALL NOT cache role lookups; each call delegates to `deps.resolveCanvasRole` exactly once on the path that requires it (steps 2 through 5).

#### Scenario: Unauthenticated request is rejected before any canvas lookup

- **WHEN** a caller invokes `requireRole(deps, null, canvasId, allowed)` with any `canvasId` and any non-empty `allowed`
- **THEN** the guard returns `{ ok: false, status: 401, errorKey: "errors.auth.unauthorized" }`
- **AND** `deps.resolveCanvasRole` is NOT called

##### Example: anonymous public-link visitor blocked from AI write surface

- **GIVEN** `session = null`, `canvasId = "canvas-public-edit-link"`, `allowed = ["owner", "editor"]`
- **WHEN** `requireRole` is invoked
- **THEN** result equals `{ ok: false, status: 401, errorKey: "errors.auth.unauthorized" }`
- **AND** the resolver stub records zero calls

#### Scenario: Authenticated request to non-existent canvas returns 404

- **WHEN** a caller invokes `requireRole(deps, { userId }, canvasId, allowed)` and `deps.resolveCanvasRole` returns `{ canvasExists: false, role: null }`
- **THEN** the guard returns `{ ok: false, status: 404, errorKey: "errors.canvas.notFound" }`

##### Example: editor of another canvas asks about an unknown canvas

- **GIVEN** `session = { userId: "user-A" }`, `canvasId = "canvas-deleted"`, resolver returns `{ canvasExists: false, role: null }`
- **WHEN** `requireRole` is invoked with `allowed = ["owner", "editor"]`
- **THEN** result equals `{ ok: false, status: 404, errorKey: "errors.canvas.notFound" }`

#### Scenario: Authenticated request to existing canvas with no role returns 403

- **WHEN** a caller invokes `requireRole(deps, { userId }, canvasId, allowed)` and `deps.resolveCanvasRole` returns `{ canvasExists: true, role: null }`
- **THEN** the guard returns `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }`

##### Example: stranger probes a private canvas

- **GIVEN** `session = { userId: "user-stranger" }`, `canvasId = "canvas-private"`, resolver returns `{ canvasExists: true, role: null }`
- **WHEN** `requireRole` is invoked with `allowed = ["owner", "editor"]`
- **THEN** result equals `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }`

#### Scenario: Role exists but is not in the allowed list returns 403

- **WHEN** a caller invokes `requireRole(deps, { userId }, canvasId, allowed)` and `deps.resolveCanvasRole` returns `{ canvasExists: true, role }` where `role` is a valid `CanvasRole` but `role` is NOT a member of `allowed`
- **THEN** the guard returns `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }`

##### Example: role × allowed permutations all collapse to forbidden

| `role` | `allowed` | Expected result |
| ------ | --------- | --------------- |
| `"viewer"` | `["owner", "editor"]` | `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }` |
| `"editor"` | `["owner"]` | `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }` |
| `"anon"` | `["owner", "editor"]` | `{ ok: false, status: 403, errorKey: "errors.canvas.forbidden" }` |

#### Scenario: Role is in the allowed list returns ok

- **WHEN** a caller invokes `requireRole(deps, { userId }, canvasId, allowed)` and `deps.resolveCanvasRole` returns `{ canvasExists: true, role }` where `role` IS a member of `allowed`
- **THEN** the guard returns `{ ok: true }`

##### Example: owner and shared editor both pass for AI write surfaces

| `role` | `allowed` | Expected result |
| ------ | --------- | --------------- |
| `"owner"` | `["owner", "editor"]` | `{ ok: true }` |
| `"editor"` | `["owner", "editor"]` | `{ ok: true }` |
| `"owner"` | `["owner"]` | `{ ok: true }` |

#### Scenario: Decision precedence is null-session before canvas-existence before role

- **WHEN** the inputs simultaneously satisfy multiple "deny" conditions
- **THEN** the earlier matrix step wins and `deps.resolveCanvasRole` is consulted only when needed (it MUST NOT be invoked when `session === null`)

##### Example: precedence locks to step 1 even if canvas does not exist

- **GIVEN** `session = null` AND a stub resolver that would return `{ canvasExists: false, role: null }`
- **WHEN** `requireRole` is invoked
- **THEN** result equals `{ ok: false, status: 401, errorKey: "errors.auth.unauthorized" }`
- **AND** the stub resolver was NOT called

### Requirement: Dev mutate endpoint enforces Permission Guard before applying mutations

The dev-only `POST /dev/canvas/:id/mutate` endpoint defined in `apps/api/src/dev/mutate-endpoint.ts` SHALL invoke `requireRole(deps.permissionGuard, session, canvasId, ["owner", "editor"])` after rate-limit admission and before parsing the request body or dispatching to `applyMutation`. When the guard returns `{ ok: false, status, errorKey }`, the endpoint SHALL respond with HTTP `status` and JSON body `{ ok: false, errorKey }`, and SHALL NOT invoke `applyMutation`. The endpoint's dependency contract `DevMutateDeps` SHALL include a `permissionGuard: PermissionGuardDeps` field so that tests inject stub resolvers without touching the database.

#### Scenario: Viewer is rejected with 403 before the mutator runs

- **WHEN** a request arrives with `session = { userId }` and the resolver returns `{ canvasExists: true, role: "viewer" }`
- **THEN** the endpoint responds with HTTP 403 and body `{ ok: false, errorKey: "errors.canvas.forbidden" }`
- **AND** `applyMutation` is NOT called

#### Scenario: Editor passes the guard and reaches the mutator

- **WHEN** a request arrives with `session = { userId }` and the resolver returns `{ canvasExists: true, role: "editor" }` and the body is valid
- **THEN** the endpoint dispatches to `applyMutation` and responds with HTTP 200 on a successful mutation result

#### Scenario: Missing session is rejected with 401

- **WHEN** a request arrives with `session = null`
- **THEN** the endpoint responds with HTTP 401 and body `{ ok: false, errorKey: "errors.auth.unauthorized" }`
- **AND** `applyMutation` is NOT called

#### Scenario: Unknown canvas is rejected with 404

- **WHEN** a request arrives with `session = { userId }` and the resolver returns `{ canvasExists: false, role: null }`
- **THEN** the endpoint responds with HTTP 404 and body `{ ok: false, errorKey: "errors.canvas.notFound" }`
- **AND** `applyMutation` is NOT called

#### Scenario: Guard runs after rate-limit but before payload validation

- **WHEN** a request arrives that would trigger both 429 (rate limit exceeded) AND 401 (no session)
- **THEN** the endpoint responds with HTTP 429 (rate limit precedes guard)

##### Example: ordering matrix for endpoint admission

| Rate-limit allowed | Session | Resolver result | Body valid | Expected status |
| ------------------ | ------- | --------------- | ---------- | --------------- |
| no | null | n/a | n/a | 429 |
| yes | null | n/a | n/a | 401 |
| yes | `{userId}` | `{canvasExists: false, role: null}` | n/a | 404 |
| yes | `{userId}` | `{canvasExists: true, role: null}` | n/a | 403 |
| yes | `{userId}` | `{canvasExists: true, role: "viewer"}` | n/a | 403 |
| yes | `{userId}` | `{canvasExists: true, role: "editor"}` | no | 400 |
| yes | `{userId}` | `{canvasExists: true, role: "editor"}` | yes | 200 |
