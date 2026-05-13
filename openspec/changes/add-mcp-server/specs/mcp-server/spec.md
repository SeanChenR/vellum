## ADDED Requirements

### Requirement: Stateless Streamable HTTP endpoint accepts JSON-RPC 2.0 at POST /api/mcp

The system SHALL expose `POST /api/mcp` as the Model Context Protocol server endpoint. The endpoint SHALL accept JSON-RPC 2.0 request bodies conforming to `{jsonrpc: "2.0", id, method, params?}`. The server SHALL be stateless — no session state SHALL be retained between requests; each request SHALL be independently authenticated and dispatched. The endpoint SHALL NOT support MCP `notifications/*`, `resources/*`, `prompts/*`, `sampling/*`, `roots/*`, or `logging/*` methods — calling any unsupported method SHALL return JSON-RPC error code `-32601` (method not found).

#### Scenario: Valid JSON-RPC request returns matching JSON-RPC response

- **GIVEN** a valid PAT in the `Authorization: Bearer` header
- **WHEN** the client POSTs `{jsonrpc: "2.0", id: "1", method: "ping"}` to `/api/mcp`
- **THEN** the server SHALL respond with HTTP 200
- **AND** the response body SHALL be `{jsonrpc: "2.0", id: "1", result: {}}`.

#### Scenario: Malformed JSON body returns -32700 parse error

- **GIVEN** a valid PAT
- **WHEN** the client POSTs an unparseable body (e.g. `not json`)
- **THEN** the server SHALL respond with HTTP 200
- **AND** the response body SHALL contain `{jsonrpc: "2.0", id: null, error: {code: -32700}}`.

#### Scenario: Invalid JSON-RPC envelope returns -32600

- **GIVEN** a valid PAT
- **WHEN** the client POSTs a JSON body lacking the `jsonrpc` field or lacking the `method` field
- **THEN** the server SHALL respond with HTTP 200
- **AND** the response body SHALL contain `{error: {code: -32600}}`.

#### Scenario: Unknown method returns -32601

- **GIVEN** a valid PAT
- **WHEN** the client POSTs `{jsonrpc: "2.0", id: "1", method: "resources/list"}`
- **THEN** the server SHALL respond with HTTP 200
- **AND** the response body SHALL contain `{id: "1", error: {code: -32601}}`.

### Requirement: PAT authentication gate sits in front of JSON-RPC dispatch

Every request to `POST /api/mcp` SHALL be authenticated via a Personal Access Token sent in the `Authorization: Bearer <token>` header. Authentication failures SHALL be reported at the HTTP layer (not inside the JSON-RPC envelope) so MCP client SDKs can handle them via standard HTTP retry / reconnect logic. Authentication SHALL run BEFORE JSON-RPC parsing — malformed JSON from an unauthenticated client SHALL still receive 401.

#### Scenario: Missing Authorization header returns HTTP 401

- **GIVEN** a request to `POST /api/mcp` with no `Authorization` header
- **WHEN** the server processes the request
- **THEN** the server SHALL respond with HTTP 401
- **AND** the response body SHALL be empty (no JSON-RPC envelope).

#### Scenario: Invalid PAT returns HTTP 401

- **GIVEN** a request with `Authorization: Bearer vlm_pat_invalid_token`
- **WHEN** the server processes the request
- **THEN** the server SHALL respond with HTTP 401.

#### Scenario: Expired PAT returns HTTP 401

- **GIVEN** a PAT whose `expires_at` is in the past
- **WHEN** the client uses it
- **THEN** the server SHALL respond with HTTP 401.

#### Scenario: Revoked PAT returns HTTP 401

- **GIVEN** a PAT whose `revoked_at` is set
- **WHEN** the client uses it
- **THEN** the server SHALL respond with HTTP 401.

### Requirement: tools/list returns the full Vellum tool surface as MCP tool descriptors

The `tools/list` method SHALL return every entry from the shared `tool-registry` (13 tools as of M15: 11 pre-existing tools `createShape`, `updateShape`, `deleteShape`, `groupShapes`, `ungroupShape`, `connectShapes`, `listShapesInViewport`, `listShapesInSelection`, `getShape`, `getCanvasBounds`, `getViewport`, plus `listCanvases` and `listShapes` added in M15) as MCP tool descriptors. Each descriptor SHALL contain `name` (string), `description` (string from the tool registry entry), `inputSchema` (JSON Schema converted from the registry entry's Zod schema), and `annotations.readOnlyHint` set to `true` for read-kind tools and `false` for write-kind tools.

#### Scenario: tools/list enumerates exactly thirteen tools

- **GIVEN** a valid PAT
- **WHEN** the client POSTs `{jsonrpc, id, method: "tools/list"}`
- **THEN** the response result `tools` array SHALL contain exactly thirteen entries
- **AND** the entry names SHALL be exactly: `createShape`, `updateShape`, `deleteShape`, `groupShapes`, `ungroupShape`, `connectShapes`, `listShapes`, `listShapesInViewport`, `listShapesInSelection`, `getShape`, `getCanvasBounds`, `getViewport`, `listCanvases`.

#### Scenario: tools/list inputSchema is valid JSON Schema for createShape

- **WHEN** the client reads the `createShape` tool descriptor
- **THEN** `inputSchema.type` SHALL be `"object"`
- **AND** `inputSchema.required` SHALL include `id`, `type`, `x`, `y`, `props`
- **AND** `inputSchema.additionalProperties` SHALL be `false`.

#### Scenario: tools/list readOnlyHint annotation distinguishes write vs read

- **WHEN** the client reads tool descriptors
- **THEN** the 6 write tools (`createShape`, `updateShape`, `deleteShape`, `groupShapes`, `ungroupShape`, `connectShapes`) SHALL have `annotations.readOnlyHint = false`
- **AND** the 6 read tools (`listShapesInViewport`, `listShapesInSelection`, `getShape`, `getCanvasBounds`, `getViewport`, `listCanvases`) SHALL have `annotations.readOnlyHint = true`.

### Requirement: tools/call dispatches to the existing tool-registry execute path with permission enforcement

The `tools/call` method SHALL execute the named tool against the supplied `arguments` and return the result wrapped in MCP content format `{content: [{type: "text", text: <JSON-stringified result>}], isError: false}` on success, or a JSON-RPC error with code `-32000` and `data.errorKey` set to the appropriate i18n key on failure. The method SHALL enforce permissions before dispatch using the existing `permission-guard.requireRole` helper:

- For write tools, the authenticated user SHALL have role `owner` or `editor` on the supplied `canvasId`.
- For read tools (except `listCanvases`), the user SHALL have role `owner`, `editor`, or `viewer` on the supplied `canvasId`.
- For `listCanvases`, no per-canvas permission check SHALL be performed (the tool is user-scoped).

Permission failures, missing canvases, and unauthorized cross-user access SHALL all return the same JSON-RPC error envelope `{code: -32000, data: {errorKey: "agent.error.invalidRequest"}}` to avoid leaking canvas existence.

#### Scenario: createShape with owner role dispatches mutator

- **GIVEN** user U1 owns canvas C1 and has a valid PAT
- **WHEN** U1's PAT calls `tools/call` with `{name: "createShape", arguments: {canvasId: "C1", id: "shape:abc", type: "geo", x: 0, y: 0, props: {}}}`
- **THEN** the existing `applyMutation` path SHALL be invoked with the same payload
- **AND** the JSON-RPC response result SHALL be `{content: [{type: "text", text: <JSON of MutationResult>}], isError: false}`.

#### Scenario: tools/call against a canvas the user has no role on returns invalidRequest

- **GIVEN** user U2's PAT, and a canvas C1 owned by U1 with no share to U2
- **WHEN** U2 calls `tools/call` with `{name: "getShape", arguments: {canvasId: "C1", shapeId: "shape:abc"}}`
- **THEN** the JSON-RPC response SHALL be `{error: {code: -32000, data: {errorKey: "agent.error.invalidRequest"}}}`
- **AND** the response SHALL NOT distinguish between "canvas does not exist" and "canvas exists but you have no role".

#### Scenario: viewer role attempts write tool returns invalidRequest

- **GIVEN** user U2 has `viewer` role on canvas C1
- **WHEN** U2's PAT calls `tools/call` with `{name: "createShape", arguments: {canvasId: "C1", ...}}`
- **THEN** the response SHALL be `{error: {code: -32000, data: {errorKey: "agent.error.invalidRequest"}}}`.

#### Scenario: listCanvases bypasses per-canvas check and returns user's accessible canvases

- **GIVEN** user U1 owns 3 canvases and is shared as `viewer` on 2 canvases owned by U2
- **WHEN** U1's PAT calls `tools/call` with `{name: "listCanvases", arguments: {}}`
- **THEN** the JSON-RPC response result SHALL contain 5 canvas entries
- **AND** each entry SHALL contain `id`, `title`, and `role` fields
- **AND** the 3 owned canvases SHALL report `role: "owner"`
- **AND** the 2 shared canvases SHALL report `role: "viewer"`.

#### Scenario: Tool arguments failing Zod validation return invalidArgs

- **GIVEN** a valid PAT
- **WHEN** the client calls `tools/call` with `{name: "createShape", arguments: {id: "shape:abc"}}` (missing required fields)
- **THEN** the response SHALL be `{error: {code: -32000, data: {errorKey: "agent.tool.invalidArgs"}}}`.

#### Scenario: Unknown tool name returns toolUnknown

- **WHEN** the client calls `tools/call` with `{name: "nonexistent", arguments: {}}`
- **THEN** the response SHALL be `{error: {code: -32000, data: {errorKey: "agent.tool.unknown"}}}`.

### Requirement: MCP_TOOL_CALL_RULE rate-limits tools/call at 60 calls per 60 seconds per user

The server SHALL enforce a rate limit on `tools/call` requests using the existing `RateLimiter` with the rule `{ windowMs: 60_000, max: 60 }`, keyed by `mcp:user:<userId>`. All Personal Access Tokens belonging to the same user SHALL share one bucket. Other JSON-RPC methods (`initialize`, `ping`, `tools/list`) SHALL NOT consume the bucket. When the bucket is exhausted, the server SHALL respond with HTTP 429, an empty body, and a `Retry-After` header indicating seconds until the next token refills.

#### Scenario: 61st tools/call within 60 seconds returns HTTP 429

- **GIVEN** user U1 has consumed 60 `tools/call` requests in the last 60 seconds
- **WHEN** U1 sends a 61st `tools/call`
- **THEN** the server SHALL respond with HTTP 429
- **AND** the `Retry-After` header SHALL be present and non-empty.

#### Scenario: tools/list does NOT consume the bucket

- **GIVEN** user U1 has consumed all 60 tokens in the bucket
- **WHEN** U1 sends a `tools/list` request
- **THEN** the server SHALL respond with HTTP 200 and a normal JSON-RPC response (not 429).

#### Scenario: Multiple PATs from the same user share the bucket

- **GIVEN** user U1 has two PATs P1 and P2, and has used P1 for 60 `tools/call` in the last 60 seconds
- **WHEN** U1 sends a `tools/call` using P2
- **THEN** the server SHALL respond with HTTP 429 (shared per-user bucket).

### Requirement: initialize returns server capabilities advertising tools support

The `initialize` method SHALL return server metadata conforming to the MCP protocol: `protocolVersion: "2024-11-05"`, `capabilities: {tools: {}}` (empty object signaling tools support without listChanged), and `serverInfo: {name: "vellum-mcp-server", version: <package version>}`. The server SHALL accept the client's protocol version in `params.protocolVersion` but SHALL respond with its own version regardless of mismatch.

#### Scenario: initialize returns server info and tools capability

- **WHEN** the client POSTs `{jsonrpc, id, method: "initialize", params: {protocolVersion: "2024-11-05", capabilities: {}, clientInfo: {name: "claude-desktop", version: "1.0"}}}`
- **THEN** the response result SHALL contain `protocolVersion: "2024-11-05"`
- **AND** `capabilities.tools` SHALL be present
- **AND** `serverInfo.name` SHALL be `"vellum-mcp-server"`
- **AND** `serverInfo.version` SHALL be a non-empty string.

### Requirement: ping returns empty result for client health checks

The `ping` method SHALL be supported and SHALL return an empty object `{}` as the result. It SHALL NOT consume the rate-limit bucket. MCP clients use this for periodic connection health checks.

#### Scenario: ping returns empty result

- **WHEN** the client POSTs `{jsonrpc, id, method: "ping"}`
- **THEN** the response SHALL be `{jsonrpc: "2.0", id, result: {}}`.

### Requirement: Last-used tracking updates at most once per 60 seconds per token

The server SHALL update `personal_access_tokens.last_used_at` on every successful authenticated request, throttled to at most one UPDATE per token per 60 seconds. The throttle SHALL be enforced by an in-memory tracking map (similar capacity to the rate-limit LRU). Authentication itself SHALL NOT wait for or block on the throttled write.

#### Scenario: Two requests within 60 seconds produce one DB write

- **GIVEN** a valid PAT used at time T0
- **WHEN** the same PAT is used again at time T0 + 30 seconds
- **THEN** only one `UPDATE personal_access_tokens SET last_used_at` SHALL have been executed.

#### Scenario: Requests 60+ seconds apart produce separate writes

- **GIVEN** a valid PAT used at time T0
- **WHEN** the same PAT is used at time T0 + 90 seconds
- **THEN** two separate `UPDATE` statements SHALL have been executed.

### Requirement: Zod-to-JSON-Schema conversion is in-tree and snapshot-tested per tool

The server SHALL convert `tool-registry` Zod schemas to JSON Schema using an in-tree converter at `apps/api/src/mcp/zod-to-json-schema.ts` that supports the subset of Zod features used by the 12 tools (`z.object().strict()`, `z.string()`, `z.string().regex()`, `z.string().min()`, `z.number().finite()`, `z.number().int()`, `z.literal()`, `z.enum()`, `z.array()`, `z.record(z.string(), z.unknown())`, `z.optional()`, `z.nullable()`, `z.discriminatedUnion()`). The conversion output SHALL match a snapshot per tool in the unit test suite. The converter SHALL NOT depend on any external npm package.

#### Scenario: All twelve tool schemas convert to valid JSON Schema

- **WHEN** the converter runs against every entry in `tool-registry`
- **THEN** each output SHALL pass JSON Schema draft-07 structural validation
- **AND** the converter SHALL NOT throw or return undefined.

#### Scenario: createShape Zod schema converts to JSON Schema with correct required fields

- **WHEN** the converter runs against `createShapePayloadSchema`
- **THEN** the result SHALL have `type: "object"`, `additionalProperties: false`, `required: ["id", "type", "x", "y", "props"]`
- **AND** `properties.id.pattern` SHALL match the shape id regex.
