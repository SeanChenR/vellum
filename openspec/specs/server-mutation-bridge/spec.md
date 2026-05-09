# server-mutation-bridge Specification

## Purpose

TBD - created by archiving change 'add-server-tldraw-mutator'. Update Purpose after archive.

## Requirements

### Requirement: Server tldraw Mutator exposes applyMutation for server-initiated room edits

The system SHALL provide a server-side `Server tldraw Mutator` module exposing `applyMutation(canvasId: string, mutations: Mutation[]): Promise<MutationResult>`. The function SHALL apply the supplied mutations to the active `TLSocketRoom` for `canvasId` and rely on the existing tldraw sync broadcast pipeline to propagate the resulting record changes to all connected clients. `Mutation` SHALL be a discriminated union with the following supported variants:

- `{ type: "createShape", payload: CreateShapePayload }`
- `{ type: "updateShape", payload: UpdateShapePayload }`
- `{ type: "deleteShape", payload: DeleteShapePayload }`
- `{ type: "groupShapes", payload: GroupShapesPayload }`
- `{ type: "ungroupShape", payload: UngroupShapePayload }`
- `{ type: "connectShapes", payload: ConnectShapesPayload }`

`CreateShapePayload` SHALL have a REQUIRED `props: Record<string, unknown>` field (NOT optional). Callers that genuinely have no props for a given shape type SHALL pass `props: {}` explicitly. Reason: every vellum custom shape type (markdown, code, callout, link-card) requires at least one type-specific prop key, and OpenAI strict tool calling treats `optional()` Zod fields as "skippable", which the LLM did skip — producing tldraw schema-validation rejections at apply time. Making `props` required forces the contract through both the schema and the LLM tool surface.

The function SHALL return `{ ok: true, appliedCount }` on success and `{ ok: false, errorKey }` on failure, where `errorKey` is one of the i18n keys defined under `errors.devMutate.*` or `errors.fullToolSurface.*`. The function SHALL NOT throw for expected failure modes (invalid payload, room not active, mutation rejected by the room, referenced shape or group not found) — those modes MUST be returned as `{ ok: false, errorKey }`. All mutations in a single `applyMutation` call SHALL be applied within one `room.updateStore` transaction so that the client SHALL treat the resulting broadcast as a single undo entry.

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

#### Scenario: Mutator rejects a createShape payload without props

- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "createShape", payload: { id: "shape:no-props", type: "markdown", x: 0, y: 0 } }])` (note: no `props` field)
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.devMutate.invalidPayload" }`
- **AND** the room state MUST NOT change

#### Scenario: Mutator rejects when no active room exists for the canvas

- **GIVEN** there is no entry in the room registry for `<canvasId>` (no client is connected)
- **WHEN** the server calls `applyMutation(<canvasId>, [<any valid mutation>])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" }`
- **AND** no broadcast MUST occur

#### Scenario: Mutator applies a multi-variant batch in one transaction

- **GIVEN** a sync room exists for `<canvasId>` with one connected client whose document already contains `shape:src` and `shape:dst`
- **WHEN** the server calls `applyMutation(<canvasId>, [createShape(shape:new), updateShape(shape:src), connectShapes(from:src, to:dst)])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 3 }`
- **AND** the connected client MUST receive a single sync update batch that contains all resulting record changes
- **AND** a single client-side undo MUST revert all three mutations together


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

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


<!-- @trace
source: add-server-tldraw-mutator
updated: 2026-05-06
code:
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/index.ts
  - apps/api/src/dev/mutate-endpoint.ts
  - apps/api/src/sync/mutator.ts
  - docs/adr/0013-server-tldraw-mutator-trade-offs.md
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/sync/index.ts
tests:
  - apps/api/src/sync/mutator-wiring.test.ts
  - apps/api/src/dev/mutate-endpoint.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
  - apps/api/src/sync/mutator.test.ts
-->

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


<!-- @trace
source: add-server-tldraw-mutator
updated: 2026-05-06
code:
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/index.ts
  - apps/api/src/dev/mutate-endpoint.ts
  - apps/api/src/sync/mutator.ts
  - docs/adr/0013-server-tldraw-mutator-trade-offs.md
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/sync/index.ts
tests:
  - apps/api/src/sync/mutator-wiring.test.ts
  - apps/api/src/dev/mutate-endpoint.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
  - apps/api/src/sync/mutator.test.ts
-->

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


<!-- @trace
source: add-server-tldraw-mutator
updated: 2026-05-06
code:
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/index.ts
  - apps/api/src/dev/mutate-endpoint.ts
  - apps/api/src/sync/mutator.ts
  - docs/adr/0013-server-tldraw-mutator-trade-offs.md
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/sync/index.ts
tests:
  - apps/api/src/sync/mutator-wiring.test.ts
  - apps/api/src/dev/mutate-endpoint.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
  - apps/api/src/sync/mutator.test.ts
-->

---
### Requirement: Mutator integration test exercises the real sync broadcast path

The change SHALL include an integration test that boots the real Bun.serve sync server, opens a real WebSocket client against `/sync/<canvasId>`, sends a `POST /dev/canvas/<canvasId>/mutate` request from the test, and asserts that the WebSocket client receives a sync update message containing the newly created shape's record. The test SHALL NOT mock the `TLSocketRoom`, the room registry, the WebSocket transport, or the broadcast path. The test SHALL use a fixture canvas record in a test database and SHALL clean up the canvas and any persisted snapshot after the test run.

#### Scenario: Integration test asserts WS client receives a broadcast update

- **GIVEN** the integration test harness has started the sync server and inserted a fixture canvas
- **AND** a WebSocket client is connected to `/sync/<fixtureCanvasId>`
- **WHEN** the test issues `POST /dev/canvas/<fixtureCanvasId>/mutate` with a `createShape` payload
- **THEN** the test MUST receive an HTTP 200 response from the dev endpoint
- **AND** the WebSocket client MUST receive at least one sync update message containing the new shape record within the test's timeout

<!-- @trace
source: add-server-tldraw-mutator
updated: 2026-05-06
code:
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/index.ts
  - apps/api/src/dev/mutate-endpoint.ts
  - apps/api/src/sync/mutator.ts
  - docs/adr/0013-server-tldraw-mutator-trade-offs.md
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/sync/index.ts
tests:
  - apps/api/src/sync/mutator-wiring.test.ts
  - apps/api/src/dev/mutate-endpoint.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
  - apps/api/src/sync/mutator.test.ts
-->

---
### Requirement: Mutator updateShape variant merges partial props onto an existing shape

The mutator SHALL accept an `updateShape` mutation with payload `{ id: string, partial: ShapePartial }`. When applied, the mutator SHALL look up the record at `id` via `RoomStoreMethods.get`, merge the supplied `partial` fields onto that record (deep-merging `props` and shallow-merging top-level fields like `x`, `y`, `rotation`, `meta`), and write the merged record back via `RoomStoreMethods.put`. If no record exists at `id`, the mutator SHALL resolve to `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }` and SHALL NOT touch the store.

#### Scenario: updateShape merges partial onto existing record

- **GIVEN** the room contains `{ id: "shape:abc", type: "geo", x: 10, y: 20, props: { color: "red", w: 100 } }`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "updateShape", payload: { id: "shape:abc", partial: { x: 50, props: { color: "blue" } } } }])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 1 }`
- **AND** the resulting record at `shape:abc` MUST equal `{ id: "shape:abc", type: "geo", x: 50, y: 20, props: { color: "blue", w: 100 } }`

#### Scenario: updateShape rejects unknown shape id

- **GIVEN** the room contains no record at `shape:does-not-exist`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "updateShape", payload: { id: "shape:does-not-exist", partial: { x: 0 } } }])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }`
- **AND** the room state MUST NOT change

##### Example: merge semantics matrix

| Existing record props      | Partial input                | Resulting record props          |
| -------------------------- | ---------------------------- | ------------------------------- |
| `{ color: "red", w: 100 }` | `{ props: { color: "blue" }}`| `{ color: "blue", w: 100 }`     |
| `{ color: "red", w: 100 }` | `{ props: { h: 50 } }`       | `{ color: "red", w: 100, h: 50 }`|
| `{ color: "red" }`         | `{ x: 99 }`                  | unchanged props; top-level x=99 |


<!-- @trace
source: add-full-tool-surface
updated: 2026-05-06
code:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/mutator.ts
  - packages/shared/src/locales/en.json
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/mutation-types.ts
  - docs/adr/0014-full-tool-surface-tldraw-record-shapes.md
  - packages/shared/src/tool-types.ts
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
-->

---
### Requirement: Mutator deleteShape variant removes a shape from the store

The mutator SHALL accept a `deleteShape` mutation with payload `{ id: string }`. When applied, the mutator SHALL call `RoomStoreMethods.delete(id)`. If no record exists at `id`, the mutator SHALL resolve to `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }` and SHALL NOT issue a delete. After a successful delete, the room MUST broadcast a sync update reflecting the removed record.

#### Scenario: deleteShape removes an existing shape

- **GIVEN** the room contains `{ id: "shape:abc", type: "geo", ... }`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "deleteShape", payload: { id: "shape:abc" } }])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 1 }`
- **AND** the connected client MUST receive a sync update indicating `shape:abc` was removed
- **AND** subsequent calls to `getShape(<canvasId>, "shape:abc")` MUST resolve to `null`

#### Scenario: deleteShape rejects unknown shape id

- **GIVEN** the room contains no record at `shape:ghost`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "deleteShape", payload: { id: "shape:ghost" } }])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }`
- **AND** no delete MUST be issued


<!-- @trace
source: add-full-tool-surface
updated: 2026-05-06
code:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/mutator.ts
  - packages/shared/src/locales/en.json
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/mutation-types.ts
  - docs/adr/0014-full-tool-surface-tldraw-record-shapes.md
  - packages/shared/src/tool-types.ts
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
-->

---
### Requirement: Mutator groupShapes variant creates a group record and reparents children

The mutator SHALL accept a `groupShapes` mutation with payload `{ shapeIds: string[], groupId: string }`. When applied, the mutator SHALL within a single `updateStore` transaction:

1. Verify every `shapeIds[i]` exists in the store (via `RoomStoreMethods.get`)
2. Insert a new shape record with `id = groupId`, `type = "group"`, and the same `parentId` as the first child
3. For each child in `shapeIds`, fetch its record, set its `parentId` to `groupId`, and write it back

If any shape in `shapeIds` does not exist, the mutator SHALL throw inside the transaction so that no record is committed; the resulting `MutationResult` SHALL be `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }`.

#### Scenario: groupShapes creates a group and reparents children atomically

- **GIVEN** the room contains `shape:a` and `shape:b`, both with `parentId: "page:page"`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "groupShapes", payload: { shapeIds: ["shape:a", "shape:b"], groupId: "shape:grp1" } }])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 1 }`
- **AND** the room MUST contain a record at `shape:grp1` with `type: "group"` and `parentId: "page:page"`
- **AND** the records at `shape:a` and `shape:b` MUST have `parentId: "shape:grp1"`
- **AND** the connected client MUST receive these changes as a single sync batch

#### Scenario: groupShapes rejects when any child does not exist

- **GIVEN** the room contains `shape:a` but no record at `shape:missing`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "groupShapes", payload: { shapeIds: ["shape:a", "shape:missing"], groupId: "shape:grp2" } }])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }`
- **AND** no record at `shape:grp2` MUST be created
- **AND** the `parentId` of `shape:a` MUST NOT change


<!-- @trace
source: add-full-tool-surface
updated: 2026-05-06
code:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/mutator.ts
  - packages/shared/src/locales/en.json
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/mutation-types.ts
  - docs/adr/0014-full-tool-surface-tldraw-record-shapes.md
  - packages/shared/src/tool-types.ts
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
-->

---
### Requirement: Mutator ungroupShape variant removes a group and re-parents children

The mutator SHALL accept an `ungroupShape` mutation with payload `{ groupId: string }`. When applied, the mutator SHALL within a single `updateStore` transaction:

1. Fetch the record at `groupId`; if it is missing or its `type` is not `"group"`, the mutator SHALL throw so the transaction aborts and the result is `{ ok: false, errorKey: "errors.fullToolSurface.groupNotFound" }`
2. Iterate the store and for every record whose `parentId === groupId`, set its `parentId` to the group's own `parentId` and write it back
3. Delete the group record at `groupId`

#### Scenario: ungroupShape re-parents children to the group's parent

- **GIVEN** the room contains group `shape:grp1` with `parentId: "page:page"`, plus `shape:a` and `shape:b` both with `parentId: "shape:grp1"`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "ungroupShape", payload: { groupId: "shape:grp1" } }])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 1 }`
- **AND** the room MUST NOT contain a record at `shape:grp1`
- **AND** `shape:a` and `shape:b` MUST have `parentId: "page:page"`

#### Scenario: ungroupShape rejects when target is not a group

- **GIVEN** the room contains `shape:abc` with `type: "geo"` (not a group)
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "ungroupShape", payload: { groupId: "shape:abc" } }])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.fullToolSurface.groupNotFound" }`
- **AND** no record MUST be deleted


<!-- @trace
source: add-full-tool-surface
updated: 2026-05-06
code:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/mutator.ts
  - packages/shared/src/locales/en.json
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/mutation-types.ts
  - docs/adr/0014-full-tool-surface-tldraw-record-shapes.md
  - packages/shared/src/tool-types.ts
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
-->

---
### Requirement: Mutator connectShapes variant creates an arrow shape with start and end bindings

The mutator SHALL accept a `connectShapes` mutation with payload `{ fromId: string, toId: string, arrowId: string, label?: string }`. When applied, the mutator SHALL within a single `updateStore` transaction:

1. Verify both `fromId` and `toId` exist in the store
2. Insert a new shape record with `id = arrowId`, `type = "arrow"`, and (when supplied) the `label` text in props
3. Insert a start binding record connecting `arrowId` to `fromId` (terminal `"start"`)
4. Insert an end binding record connecting `arrowId` to `toId` (terminal `"end"`)

If either endpoint does not exist, the mutator SHALL throw so that the transaction aborts and the result is `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }`.

#### Scenario: connectShapes creates an arrow with two bindings atomically

- **GIVEN** the room contains `shape:src` and `shape:dst`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "connectShapes", payload: { fromId: "shape:src", toId: "shape:dst", arrowId: "shape:arrow1", label: "auth" } }])`
- **THEN** the function MUST resolve to `{ ok: true, appliedCount: 1 }`
- **AND** the room MUST contain a record at `shape:arrow1` with `type: "arrow"`
- **AND** the room MUST contain two binding records connecting `shape:arrow1` to `shape:src` and `shape:dst` respectively
- **AND** the connected client MUST receive these records as a single sync batch

#### Scenario: connectShapes rejects when an endpoint does not exist

- **GIVEN** the room contains `shape:src` but no record at `shape:absent`
- **WHEN** the server calls `applyMutation(<canvasId>, [{ type: "connectShapes", payload: { fromId: "shape:src", toId: "shape:absent", arrowId: "shape:arrow2" } }])`
- **THEN** the function MUST resolve to `{ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" }`
- **AND** no record at `shape:arrow2` MUST be created
- **AND** no binding records MUST be created


<!-- @trace
source: add-full-tool-surface
updated: 2026-05-06
code:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/mutator.ts
  - packages/shared/src/locales/en.json
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/mutation-types.ts
  - docs/adr/0014-full-tool-surface-tldraw-record-shapes.md
  - packages/shared/src/tool-types.ts
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
-->

---
### Requirement: Mutator readers expose snapshot-derived read tools without mutating the room

The system SHALL provide a `mutator-readers` module that exposes the following read functions, each accepting a `canvasId` and returning a `Result<T>` shape:

- `listShapesInViewport(deps, canvasId, viewport: { x, y, w, h })` — returns shapes whose bounding box intersects the supplied viewport rectangle
- `listShapesInSelection(deps, canvasId, sessionId)` — returns shapes currently selected by the connected client identified by `sessionId`
- `getShape(deps, canvasId, shapeId)` — returns the shape record summary at `shapeId`, or `null` when absent
- `getCanvasBounds(deps, canvasId)` — returns the bounding box covering all shapes in the room, or `null` when the room contains no shapes
- `getViewport(deps, canvasId, sessionId)` — returns the viewport rectangle of the connected client identified by `sessionId`, or `null` when no presence record exists for that session

Read functions SHALL derive their results from `room.getCurrentSnapshot()` and `room.getPresenceRecords()`. Read functions SHALL NOT call `room.updateStore` or modify any record. Read functions SHALL return plain TypeScript objects (defined as `ShapeSummary`, `Bounds`, `Viewport`) that are decoupled from tldraw's internal record types so that tldraw schema changes do not propagate into agent prompts.

If a viewport rectangle has negative width, negative height, or non-finite numbers, `listShapesInViewport` SHALL resolve to `{ ok: false, errorKey: "errors.fullToolSurface.invalidViewport" }`. If `listShapesInSelection` or `getViewport` is called with a `sessionId` that has no presence record in the room, the function SHALL resolve to `{ ok: false, errorKey: "errors.fullToolSurface.sessionNotFound" }`.

If no active room exists for `canvasId`, every read function SHALL resolve to `{ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" }`.

#### Scenario: listShapesInViewport returns shapes whose bounds intersect the rectangle

- **GIVEN** the room contains `shape:in` at `(10, 10)` with `w: 50, h: 50`, and `shape:out` at `(500, 500)` with `w: 50, h: 50`
- **WHEN** the server calls `listShapesInViewport(<canvasId>, { x: 0, y: 0, w: 100, h: 100 })`
- **THEN** the result MUST be `{ ok: true, data: [<summary of shape:in>] }`
- **AND** the result MUST NOT contain `shape:out`

#### Scenario: getShape returns null for an absent record

- **GIVEN** the room contains no record at `shape:missing`
- **WHEN** the server calls `getShape(<canvasId>, "shape:missing")`
- **THEN** the result MUST be `{ ok: true, data: null }`

#### Scenario: getCanvasBounds returns null on an empty room

- **GIVEN** the room contains no shape records
- **WHEN** the server calls `getCanvasBounds(<canvasId>)`
- **THEN** the result MUST be `{ ok: true, data: null }`

#### Scenario: getViewport reads the requested session's viewport from presence

- **GIVEN** the room has presence record for `sessionId = "sess-1"` whose viewport is `{ x: 0, y: 0, w: 1024, h: 768 }`
- **WHEN** the server calls `getViewport(<canvasId>, "sess-1")`
- **THEN** the result MUST be `{ ok: true, data: { x: 0, y: 0, w: 1024, h: 768 } }`

#### Scenario: listShapesInSelection rejects an unknown session

- **GIVEN** the room has no presence record for `sessionId = "sess-ghost"`
- **WHEN** the server calls `listShapesInSelection(<canvasId>, "sess-ghost")`
- **THEN** the result MUST be `{ ok: false, errorKey: "errors.fullToolSurface.sessionNotFound" }`

#### Scenario: listShapesInViewport rejects an invalid rectangle

- **WHEN** the server calls `listShapesInViewport(<canvasId>, { x: 0, y: 0, w: -5, h: 100 })`
- **THEN** the result MUST be `{ ok: false, errorKey: "errors.fullToolSurface.invalidViewport" }`

##### Example: viewport intersection matrix

| Shape bounds            | Viewport             | Included |
| ----------------------- | -------------------- | -------- |
| `(0,0,50,50)`           | `(0,0,100,100)`      | yes      |
| `(0,0,50,50)`           | `(60,60,100,100)`    | no       |
| `(50,50,50,50)`         | `(0,0,100,100)`      | yes (touches) |
| `(99,99,2,2)`           | `(0,0,100,100)`      | yes (intersects edge) |


<!-- @trace
source: add-full-tool-surface
updated: 2026-05-06
code:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/mutator.ts
  - packages/shared/src/locales/en.json
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/mutation-types.ts
  - docs/adr/0014-full-tool-surface-tldraw-record-shapes.md
  - packages/shared/src/tool-types.ts
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
-->

---
### Requirement: Tool registry enumerates the full agent tool surface

The system SHALL provide a `tool-registry` module that exposes a typed lookup table containing one entry per agent tool. The registry SHALL include all eleven tools defined in this capability: six write tools (`createShape`, `updateShape`, `deleteShape`, `groupShapes`, `ungroupShape`, `connectShapes`) and five read tools (`listShapesInViewport`, `listShapesInSelection`, `getShape`, `getCanvasBounds`, `getViewport`).

Each registry entry SHALL contain:

- `name: ToolName` — exhaustive string literal type covering all eleven tool names
- `kind: "write" | "read"` — discriminator distinguishing mutator-bound tools from snapshot-derived readers
- `description: string` — REQUIRED non-empty LLM-facing description forwarded by the agent runtime to the underlying LLM provider tool surface; for `createShape` the description SHALL enumerate every supported shape type and the per-type required `props` keys (matching `apps/api/src/sync/shape-schemas.ts`)
- `schema: ZodSchema` — Zod schema validating the tool's input payload
- `execute: (deps, canvasId, input) => Promise<Result>` — function that runs the tool against the active room or snapshot

Write-tool entries SHALL invoke `applyMutation` with a single-element `Mutation[]` array constructed from the entry's input. Read-tool entries SHALL invoke the corresponding reader function exported from `mutator-readers`. The registry SHALL NOT bypass either entry point or reimplement tool logic.

#### Scenario: Registry enumerates exactly eleven entries with correct kinds

- **WHEN** consumer code reads `Object.values(toolRegistry)`
- **THEN** the array MUST contain exactly eleven entries
- **AND** entries with `kind: "write"` MUST be six (one per write tool)
- **AND** entries with `kind: "read"` MUST be five (one per read tool)
- **AND** every entry MUST have a non-empty `name`, a non-empty `description`, a Zod `schema`, and a callable `execute`

#### Scenario: createShape description enumerates every supported shape type's required props

- **WHEN** consumer code reads `toolRegistry.createShape.description`
- **THEN** the description string MUST contain the substrings `markdown`, `code`, `callout`, `link-card`
- **AND** the description MUST name the per-type required prop keys (`content` for markdown, `source` + `language` for code, `variant` + `body` for callout, `url` for link-card)

#### Scenario: Write-tool execute routes through applyMutation

- **GIVEN** an entry `toolRegistry["createShape"]`
- **WHEN** consumer code calls `entry.execute(deps, <canvasId>, { id: "shape:abc", type: "geo", x: 0, y: 0, props: {} })`
- **THEN** the function MUST internally call `applyMutation(deps, <canvasId>, [{ type: "createShape", payload: { id: "shape:abc", type: "geo", x: 0, y: 0, props: {} } }])`
- **AND** the resolved result MUST equal what `applyMutation` returned

#### Scenario: Read-tool execute routes through the corresponding reader

- **GIVEN** an entry `toolRegistry["getShape"]`
- **WHEN** consumer code calls `entry.execute(deps, <canvasId>, { shapeId: "shape:abc" })`
- **THEN** the function MUST internally call `getShape(deps, <canvasId>, "shape:abc")`
- **AND** the resolved result MUST equal what `getShape` returned

<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->