## ADDED Requirements

### Requirement: Server tldraw Mutator exposes applyMutation for server-initiated room edits

The system SHALL provide a server-side `Server tldraw Mutator` module exposing `applyMutation(canvasId: string, mutations: Mutation[]): Promise<MutationResult>`. The function SHALL apply the supplied mutations to the active `TLSocketRoom` for `canvasId` and rely on the existing tldraw sync broadcast pipeline to propagate the resulting record changes to all connected clients. `Mutation` SHALL be a discriminated union; in this change the only supported variant is `{ type: "createShape", payload: ShapeCreatePayload }`. The function SHALL return `{ ok: true, appliedCount }` on success and `{ ok: false, errorKey }` on failure, where `errorKey` is one of the i18n keys defined under `errors.devMutate.*`. The function SHALL NOT throw for expected failure modes (invalid payload, room not active, mutation rejected by the room) — those modes MUST be returned as `{ ok: false, errorKey }`.

#### Scenario: Mutator applies a single createShape mutation against an active room

- **GIVEN** a sync room exists for `<canvasId>` with at least one connected WebSocket client
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "createShape", payload: { id: "shape:abc", type: "geo", x: 100, y: 100, props: { ... } } }])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 1 }`
- **AND** the connected WebSocket client MUST receive a sync update message that contains the new shape record

#### Scenario: Mutator rejects an invalid payload

- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "createShape", payload: { /* missing required fields */ } }])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.devMutate.invalidPayload" }`
- **AND** the room state MUST NOT change
- **AND** no sync update MUST be broadcast

#### Scenario: Mutator rejects when no active room exists for the canvas

- **GIVEN** there is no entry in the room registry for `<canvasId>` (no client is connected)
- **WHEN** the server calls `applyMutation(<canvasId>, [<any valid mutation>])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" }`
- **AND** no broadcast MUST occur

---

### Requirement: Mutator preserves batch undo semantics across the server-client bridge

The mutator SHALL apply all mutations in a single `applyMutation` call as one atomic batch with respect to the tldraw editor's undo history. After the batch is applied, a single client-side `Cmd+Z` SHALL revert ALL mutations in that batch as one undo step. Internally the mutator SHALL use a single transaction or batch primitive on the `TLSocketRoom` so that the resulting broadcast represents one logical change, not N independent changes.

#### Scenario: Two createShape mutations in one batch are undone in a single Cmd+Z

- **GIVEN** a sync room exists for `<canvasId>` with one connected client whose tldraw editor has an empty document
- **WHEN** the server calls `applyMutation(<canvasId>, [createShapeA, createShapeB])` and the client receives the resulting sync update
- **AND** the client invokes the editor's undo action exactly once
- **THEN** both `shapeA` and `shapeB` MUST be removed from the client's editor state
- **AND** the client editor MUST be back at the empty document state

#### Scenario: Single-mutation batch behaves identically to multi-mutation batch shape

- **WHEN** the server calls `applyMutation(<canvasId>, [createShapeOnly])`
- **THEN** the function MUST treat the single-element array as a one-mutation batch
- **AND** a subsequent client-side undo MUST revert that one shape

##### Example: undo behavior matrix

| applyMutation input          | client editor state after apply      | client state after one Cmd+Z      |
| ---------------------------- | ------------------------------------ | --------------------------------- |
| `[A]`                        | shapes: { A }                        | shapes: { }                       |
| `[A, B]`                     | shapes: { A, B }                     | shapes: { }                       |
| `[A, B, C]`                  | shapes: { A, B, C }                  | shapes: { }                       |

---

### Requirement: Dev-only REST endpoint POST /dev/canvas/:id/mutate triggers the mutator

The system SHALL register a REST endpoint `POST /dev/canvas/:id/mutate` ONLY when `Bun.env.NODE_ENV !== "production"`. The endpoint SHALL accept a JSON body matching the `Mutation[]` schema, SHALL validate it with Zod, SHALL call `applyMutation(:id, body.mutations)`, and SHALL return HTTP 200 with `{ ok: true, appliedCount }` on success or HTTP 4xx with `{ ok: false, errorKey }` on failure. When `Bun.env.NODE_ENV === "production"`, the endpoint SHALL NOT be registered in the server's route table — a request to that path in production SHALL return the same HTTP 404 response that any other unknown route returns (the path SHALL be physically absent from the route registration, not gated by an authn check).

#### Scenario: Dev endpoint applies a createShape and returns 200

- **GIVEN** the server is started with `NODE_ENV` unset (development mode)
- **AND** a sync room is active for `<canvasId>` with at least one connected client
- **WHEN** a `POST /dev/canvas/<canvasId>/mutate` is sent with body `{ "mutations": [{ "type": "createShape", "payload": { ...valid... } }] }`
- **THEN** the response MUST be HTTP 200 with body `{ "ok": true, "appliedCount": 1 }`
- **AND** the connected client MUST receive a sync update containing the new shape

#### Scenario: Dev endpoint validates payload and returns 400 for malformed JSON

- **WHEN** a `POST /dev/canvas/<canvasId>/mutate` is sent with body `{ "mutations": [{ "type": "createShape", "payload": {} }] }`
- **THEN** the response MUST be HTTP 400 with body `{ "ok": false, "errorKey": "errors.devMutate.invalidPayload" }`

#### Scenario: Dev endpoint returns 409 when no active room exists

- **GIVEN** no client is connected to `<canvasId>` and no room exists in the registry
- **WHEN** a `POST /dev/canvas/<canvasId>/mutate` is sent with a valid body
- **THEN** the response MUST be HTTP 409 with body `{ "ok": false, "errorKey": "errors.devMutate.canvasNotInActiveRoom" }`

#### Scenario: Production builds do not register the dev endpoint

- **GIVEN** the server is started with `NODE_ENV=production`
- **WHEN** a `POST /dev/canvas/<anyCanvasId>/mutate` is sent
- **THEN** the response MUST be HTTP 404
- **AND** the route MUST NOT appear in the server's registered route table

---

### Requirement: Dev mutator endpoint enforces a per-user rate limit

The dev mutator endpoint SHALL declare a rate-limit rule named `dev.mutate` with a token bucket of 30 requests per 60 seconds per authenticated user. The rule SHALL be registered in `apps/api/src/lib/rate-limit-rules.ts` and consumed by the endpoint handler at request time. When the limit is exceeded the endpoint SHALL return HTTP 429 with body `{ "ok": false, "errorKey": "errors.rateLimit", "retryAfter": <seconds> }` and a `Retry-After` HTTP header carrying the same number of seconds.

#### Scenario: 31st request inside a 60-second window is rejected

- **GIVEN** an authenticated user has issued 30 successful `POST /dev/canvas/<canvasId>/mutate` requests inside the last 60 seconds
- **WHEN** the same user issues a 31st `POST /dev/canvas/<canvasId>/mutate` request
- **THEN** the response MUST be HTTP 429 with body `{ "ok": false, "errorKey": "errors.rateLimit", "retryAfter": <seconds> }`
- **AND** the response MUST include a `Retry-After` header

#### Scenario: Rate-limit rule registration is enforced at server startup

- **WHEN** the dev endpoint is wired into the server without a corresponding `dev.mutate` rate-limit rule registration
- **THEN** the server startup MUST fail
- **AND** the failure MUST happen before the server begins accepting requests

---

### Requirement: Mutator integration test exercises the real sync broadcast path

The change SHALL include an integration test that boots the real Bun.serve sync server, opens a real WebSocket client against `/sync/<canvasId>`, sends a `POST /dev/canvas/<canvasId>/mutate` request from the test, and asserts that the WebSocket client receives a sync update message containing the newly created shape's record. The test SHALL NOT mock the `TLSocketRoom`, the room registry, the WebSocket transport, or the broadcast path. The test SHALL use a fixture canvas record in a test database and SHALL clean up the canvas and any persisted snapshot after the test run.

#### Scenario: Integration test asserts WS client receives a broadcast update

- **GIVEN** the integration test harness has started the sync server and inserted a fixture canvas
- **AND** a WebSocket client is connected to `/sync/<fixtureCanvasId>`
- **WHEN** the test issues `POST /dev/canvas/<fixtureCanvasId>/mutate` with a `createShape` payload
- **THEN** the test MUST receive an HTTP 200 response from the dev endpoint
- **AND** the WebSocket client MUST receive at least one sync update message containing the new shape record within the test's timeout

