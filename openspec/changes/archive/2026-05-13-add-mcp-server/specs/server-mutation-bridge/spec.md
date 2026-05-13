## MODIFIED Requirements

### Requirement: Tool registry enumerates the full agent tool surface

The system SHALL provide a `tool-registry` module that exposes a typed lookup table containing one entry per agent tool. As of M15 the registry SHALL include thirteen tools: six write tools (`createShape`, `updateShape`, `deleteShape`, `groupShapes`, `ungroupShape`, `connectShapes`), six canvas-scoped read tools (`listShapes`, `listShapesInViewport`, `listShapesInSelection`, `getShape`, `getCanvasBounds`, `getViewport`), and one user-scoped read tool (`listCanvases`).

Each registry entry SHALL contain:

- `name: ToolName` — exhaustive string literal type covering all thirteen tool names
- `kind: "write" | "read"` — discriminator distinguishing mutator-bound tools from snapshot-derived readers (`listCanvases` is `kind: "read"`)
- `description: string` — REQUIRED non-empty LLM-facing description forwarded by the agent runtime to the underlying LLM provider tool surface and by the MCP server's `tools/list` to external MCP clients. Per-shape-type descriptions SHALL be provided for the four mutating tools that operate on shape props or relationships:
  - `createShape`: SHALL enumerate every supported shape type and the per-type required `props` keys (matching `apps/api/src/sync/shape-schemas.ts`)
  - `updateShape`: SHALL enumerate the `patch.props` keys that are writable per shape type for all four custom shape types (`markdown`, `code`, `callout`, `link-card`)
  - `connectShapes`: SHALL describe the start and end shape id parameters and the arrow style props (color, dash, bend) accepted on the resulting arrow
  - `groupShapes`: SHALL describe the input array of shape ids, the resulting group behavior (children retain their absolute positions), and the absence of group-level editable props
  - `listCanvases`: SHALL describe that it returns the calling user's accessible canvases (own + shared as editor/viewer) and SHALL recommend that MCP clients call it before other tools when the user has not specified a canvas
- `schema: ZodSchema` — Zod schema validating the tool's input payload (`listCanvases` SHALL use `z.object({}).strict()`)
- `execute: (deps, canvasId, input) => Promise<Result>` — function that runs the tool against the active room or snapshot. For `listCanvases`, the `canvasId` parameter SHALL be ignored and the implementation SHALL resolve the user id from `deps` and return the user's accessible canvas list.

Write-tool entries SHALL invoke `applyMutation` with a single-element `Mutation[]` array constructed from the entry's input. Canvas-scoped read-tool entries SHALL invoke the corresponding reader function exported from `mutator-readers`. The `listCanvases` entry SHALL invoke a new `listCanvasesForUser(deps, userId)` reader at `apps/api/src/sync/list-canvases-reader.ts`. The registry SHALL NOT bypass either entry point or reimplement tool logic.

#### Scenario: Registry enumerates exactly twelve entries with correct kinds

- **WHEN** consumer code reads `Object.values(toolRegistry)`
- **THEN** the array MUST contain exactly twelve entries
- **AND** entries with `kind: "write"` MUST be six (one per write tool)
- **AND** entries with `kind: "read"` MUST be six (five canvas-scoped readers plus `listCanvases`)
- **AND** every entry MUST have a non-empty `name`, a non-empty `description`, a Zod `schema`, and a callable `execute`.

#### Scenario: createShape description enumerates every supported shape type's required props

- **WHEN** consumer code reads `toolRegistry.createShape.description`
- **THEN** the description string MUST contain the substrings `markdown`, `code`, `callout`, `link-card`
- **AND** the description MUST name the per-type required prop keys (`content` for markdown, `source` + `language` for code, `variant` + `body` for callout, `url` for link-card)
- **AND** the description MUST also contain the substring `geo` plus at least one geo variant (e.g., `rectangle`, `ellipse`, `triangle`), at least one color palette entry (e.g., `red`, `blue`, `green`, `violet`), at least one fill mode (e.g., `none`, `solid`, `semi`), and the optional `text` prop hint so the LLM knows it can place a coloured geometric shape with a label.

#### Scenario: updateShape description enumerates per-shape-type patch keys

- **WHEN** consumer code reads `toolRegistry.updateShape.description`
- **THEN** the description string MUST contain the substrings `markdown`, `code`, `callout`, `link-card`
- **AND** the description MUST name at least one writable patch key per custom shape type (e.g., `content` for markdown; `source` and `language` for code; `variant` and `body` for callout; `url` and `metadata` for link-card)
- **AND** the description MUST also contain the substring `geo` plus at least one writable geo patch key (e.g., `color`, `fill`, or `text`) so the LLM knows it can recolour or relabel a geometric shape without recreating it.

#### Scenario: connectShapes description names start and end shape ids and arrow style

- **WHEN** consumer code reads `toolRegistry.connectShapes.description`
- **THEN** the description string MUST mention the start and end shape id parameters by name
- **AND** MUST mention at least one of the arrow style props: `color`, `dash`, or `bend`.

#### Scenario: groupShapes description explains group behavior

- **WHEN** consumer code reads `toolRegistry.groupShapes.description`
- **THEN** the description string MUST mention that grouped children retain their absolute positions
- **AND** MUST mention that the group itself has no editable props.

#### Scenario: listCanvases description signals user-scoped discovery

- **WHEN** consumer code reads `toolRegistry.listCanvases.description`
- **THEN** the description string MUST contain a phrase indicating that it lists canvases the user can access
- **AND** MUST mention that each returned entry includes the user's role on that canvas.

#### Scenario: Write-tool execute routes through applyMutation

- **GIVEN** an entry `toolRegistry["createShape"]`
- **WHEN** consumer code calls `entry.execute(deps, <canvasId>, { id: "shape:abc", type: "geo", x: 0, y: 0, props: {} })`
- **THEN** the function MUST internally call `applyMutation(deps, <canvasId>, [{ type: "createShape", payload: { id: "shape:abc", type: "geo", x: 0, y: 0, props: {} } }])`
- **AND** the resolved result MUST equal what `applyMutation` returned.

#### Scenario: Read-tool execute routes through the corresponding reader

- **GIVEN** an entry `toolRegistry["getShape"]`
- **WHEN** consumer code calls `entry.execute(deps, <canvasId>, { shapeId: "shape:abc" })`
- **THEN** the function MUST internally call `getShape(deps, <canvasId>, "shape:abc")`
- **AND** the resolved result MUST equal what `getShape` returned.

#### Scenario: listCanvases execute routes through listCanvasesForUser ignoring canvasId

- **GIVEN** an entry `toolRegistry["listCanvases"]` and `deps.session.userId = "user_42"`
- **WHEN** consumer code calls `entry.execute(deps, "any-canvas-id-or-placeholder", {})`
- **THEN** the function MUST internally call `listCanvasesForUser(deps, "user_42")`
- **AND** the resolved result MUST equal what `listCanvasesForUser` returned
- **AND** the `canvasId` argument MUST NOT be used in the resolution.
