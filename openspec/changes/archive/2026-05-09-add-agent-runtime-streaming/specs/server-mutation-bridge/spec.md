## MODIFIED Requirements

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
