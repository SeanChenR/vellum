## MODIFIED Requirements

### Requirement: Tool registry enumerates the full agent tool surface

The system SHALL provide a `tool-registry` module that exposes a typed lookup table containing one entry per agent tool. The registry SHALL include all eleven tools defined in this capability: six write tools (`createShape`, `updateShape`, `deleteShape`, `groupShapes`, `ungroupShape`, `connectShapes`) and five read tools (`listShapesInViewport`, `listShapesInSelection`, `getShape`, `getCanvasBounds`, `getViewport`).

Each registry entry SHALL contain:

- `name: ToolName` — exhaustive string literal type covering all eleven tool names
- `kind: "write" | "read"` — discriminator distinguishing mutator-bound tools from snapshot-derived readers
- `description: string` — REQUIRED non-empty LLM-facing description forwarded by the agent runtime to the underlying LLM provider tool surface. Per-shape-type descriptions SHALL be provided for the four mutating tools that operate on shape props or relationships:
  - `createShape`: SHALL enumerate every supported shape type and the per-type required `props` keys (matching `apps/api/src/sync/shape-schemas.ts`)
  - `updateShape`: SHALL enumerate the `patch.props` keys that are writable per shape type for all four custom shape types (`markdown`, `code`, `callout`, `link-card`)
  - `connectShapes`: SHALL describe the start and end shape id parameters and the arrow style props (color, dash, bend) accepted on the resulting arrow
  - `groupShapes`: SHALL describe the input array of shape ids, the resulting group behavior (children retain their absolute positions), and the absence of group-level editable props
- `schema: ZodSchema` — Zod schema validating the tool's input payload
- `execute: (deps, canvasId, input) => Promise<Result>` — function that runs the tool against the active room or snapshot

Write-tool entries SHALL invoke `applyMutation` with a single-element `Mutation[]` array constructed from the entry's input. Read-tool entries SHALL invoke the corresponding reader function exported from `mutator-readers`. The registry SHALL NOT bypass either entry point or reimplement tool logic.

#### Scenario: Registry enumerates exactly eleven entries with correct kinds

- **WHEN** consumer code reads `Object.values(toolRegistry)`
- **THEN** the array MUST contain exactly eleven entries
- **AND** entries with `kind: "write"` MUST be six (one per write tool)
- **AND** entries with `kind: "read"` MUST be five (one per read tool)
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

## ADDED Requirements

### Requirement: Mutator backfills tldraw geo required props on createShape

The mutator SHALL accept `createShape` payloads with `type: "geo"` from the agent tool surface even when the LLM only supplies a slim subset of geo props (any of `geo`, `color`, `fill`, `dash`, `size`, `text`, `w`, `h`). Before writing the record via `store.put`, the mutator SHALL fill every remaining tldraw-required geo record prop (`align`, `verticalAlign`, `font`, `labelColor`, `url`, `growY`, `scale`, plus any of the slim-set keys the caller did not provide) with sensible defaults so the record passes tldraw's `geoShapeProps` validator.

When the caller supplies a plain-text `text` key, the mutator SHALL convert it to tldraw's richText structure (via `toRichText`) and drop the `text` key. When `text` is omitted, the mutator SHALL still emit a valid empty richText document so the record satisfies the schema.

The mutator SHALL NOT apply this normalisation to non-geo shape types (`markdown`, `code`, `callout`, `link-card`) — those continue to be validated directly by the vellum store schema and their props pass through untouched.

#### Scenario: createShape with type='geo' and empty props fills every required default

- **WHEN** consumer code calls `applyMutation(deps, canvasId, [{ type: "createShape", payload: { id: "shape:g", type: "geo", x: 0, y: 0, props: {} } }])`
- **THEN** the resulting record stored via `store.put` MUST have `props.geo` populated (default `"rectangle"`)
- **AND** `props.color`, `props.fill`, `props.dash`, `props.size`, `props.font`, `props.align`, `props.verticalAlign`, `props.labelColor`, `props.url`, `props.growY`, `props.scale`, `props.w`, and `props.h` MUST all be populated with valid values
- **AND** `props.richText` MUST be a valid richText document (`{ type: "doc", ... }`).

#### Scenario: createShape with type='geo' honours user-supplied geo variant, color, and text

- **WHEN** consumer code calls `applyMutation` with `payload.props = { geo: "ellipse", color: "blue", text: "label" }`
- **THEN** the stored record MUST have `props.geo === "ellipse"` and `props.color === "blue"`
- **AND** `props.text` MUST NOT appear in the stored record
- **AND** `props.richText` MUST contain the string `"label"` in its text content.

#### Scenario: createShape with non-geo types passes props through unchanged

- **WHEN** consumer code calls `applyMutation` with `payload = { id: "shape:m", type: "markdown", x: 0, y: 0, props: { content: "hello", w: 320, h: 180 } }`
- **THEN** the stored record's `props` MUST equal `{ content: "hello", w: 320, h: 180 }` exactly — the mutator MUST NOT inject geo defaults onto non-geo records.

### Requirement: Mutator converts text patches to richText on updateShape against geo shapes

When `updateShape` targets an existing record whose `type === "geo"` and the supplied `partial.props` contains a `text` key, the mutator SHALL convert the string value to a richText structure (via `toRichText`), strip the `text` key from the partial, and merge the resulting partial onto the existing record's props. The mutator SHALL NOT inject other geo defaults on update because doing so would clobber the existing record's user-set fields.

#### Scenario: updateShape on geo with `props.text` converts to richText without clobber

- **GIVEN** an existing record `shape:gu` of `type: "geo"` with `props = { geo: "rectangle", color: "black" }`
- **WHEN** consumer code calls `applyMutation(deps, canvasId, [{ type: "updateShape", payload: { id: "shape:gu", partial: { props: { text: "new" } } } }])`
- **THEN** the updated record's `props.richText` MUST contain the string `"new"`
- **AND** the updated record MUST NOT have a `props.text` key
- **AND** the existing `props.color === "black"` MUST be preserved.

#### Scenario: updateShape on geo with non-text props passes through unchanged

- **WHEN** consumer code calls `applyMutation` with `partial.props = { color: "violet" }` against a geo record
- **THEN** the updated record's `props.color` MUST be `"violet"`
- **AND** no other geo defaults MUST be added that were not in `partial.props` or the existing record.
