# ADR-0014: Full Tool Surface — tldraw record shape choices

**Status:** Accepted
**Date:** 2026-05-06
**Decider:** project owner
**Context change:** [`add-full-tool-surface`](../../openspec/changes/archive/) (M12.2)

## Context

M12.2 extends the Server tldraw Mutator (M12.1, ADR-0013) from a single
`createShape` variant to the full agent tool surface (5 write variants
+ 5 read tools + a typed registry). Two tool variants — `groupShapes`
and `connectShapes` — produce non-trivial tldraw record shapes whose
schema requirements were not obvious from `@tldraw/sync-core`'s public
surface; the read-side tools rely on `room.getPresenceRecords()`, which
tldraw marks `@internal`.

This ADR records the record shapes chosen and the canary strategy that
guards against tldraw upgrades silently breaking those shapes.

## Decisions recorded

### Group records — `type: "group"` shape + `parentId` reparenting

`groupShapes` builds a group via two record-level operations inside one
`updateStore` transaction:

1. `put` a new shape record with `type: "group"`, `parentId` inherited
   from the first child, and an otherwise-empty props bag.
2. For each shape in the input `shapeIds[]`, `get` the existing record,
   set its `parentId` to the new group's id, `put` it back.

`ungroupShape` reverses the operation: `get` the group record (must
have `type: "group"`), iterate `getAll()` to find every record whose
`parentId` matches, set their `parentId` back to the group's parent,
then `delete` the group record.

Why this shape:

- tldraw 4.x's `group` is itself a `shape:` record with `type: "group"`.
  No separate `group:` record type. Verified at implementation time
  against `@tldraw/tlschema@4.5.10`.
- `parentId` reparenting matches what tldraw's client-side
  `editor.groupShapes()` does in the equivalent action.
- Atomic-on-throw is preserved: `updateStore`'s transaction discards
  all writes if any step throws, so a missing-child precondition
  (which throws `Error("errors.fullToolSurface.shapeNotFound")`) leaves
  the room unchanged.

### Arrow + binding records — fully-populated props mirroring tldraw defaults

`connectShapes` produces three records inside one `updateStore`:

1. The arrow shape (`typeName: "shape"`, `type: "arrow"`) with a
   **fully-populated** props bag matching tldraw 4.x's
   `arrowShape.getDefaultProps()`. tldraw's schema validator rejects
   any arrow-shape `put` that omits even a single required prop; the
   missing-prop failure mode is silent at the WS layer (the `put`
   throws inside `updateStore`, the mutator catches and returns
   `errors.devMutate.mutationFailed`).
2. A start binding (`typeName: "binding"`, `type: "arrow"`) with
   `terminal: "start"` plus the surrounding tldraw 4.x prop set
   (`normalizedAnchor`, `isExact`, `isPrecise`, `snap`).
3. An end binding (same shape, `terminal: "end"`).

Why this shape:

- Bindings live in their own record type — narrower than shape records
  (no `x` / `y` / `rotation` / `parentId` / `index`).
- Fully-populated arrow props are non-negotiable: tldraw's strict
  validator means any missing property fails the entire transaction.
  Defaults chosen here mirror the literal defaults in tldraw's source
  so visual presentation matches what client-side `editor` would
  produce.
- richText is structured according to ProseMirror's doc/paragraph/text
  format used by tldraw 4.x; absence of label produces a single empty
  paragraph (rather than `null`, which the schema rejects).

### Read-side: `room.getPresenceRecords()` is `@internal`, used anyway

`listShapesInSelection` and `getViewport` derive their results from
per-session presence records — `selectedShapeIds`, `camera`,
`screenBounds`. The only public-ish entry point that yields these
records is `room.getPresenceRecords()`, marked `@internal` in tldraw
4.5.10.

Same trade-off as ADR-0013's adoption of `updateStore` (also
`@deprecated` then): the reader path uses the internal API; the readers
module's integration tests will fail first if a tldraw upgrade changes
the presence record shape, acting as the canary.

Replacement candidates — `editor.getInstancePresence()` or `useEditor()`
hooks — are client-side only and can't run inside the sync server.
A future tldraw release that exposes presence over a public server-side
API would let us swap; until then, internal-API use is the only
working path.

### Read-side: ShapeSummary stays decoupled from `TLShape`

Readers return `ShapeSummary` / `Bounds` / `Viewport` plain objects, not
`TLShape` records. `props` is preserved as an opaque
`Record<string, unknown>` because shape-type-specific schemas (the
4 Vellum custom shapes plus tldraw's defaults) are not unified.

Why decouple:

- Agent prompts and downstream tools speak `ShapeSummary`. A tldraw
  schema change (tldraw 4.x → 5.x for example) cannot ripple into
  agent-prompt rewrites — only the readers module changes.
- `props` opacity lets each shape type evolve independently. Agents
  that need specific shape props can call a future `getShapeProps`
  reader; M12.2 doesn't add it because no caller needs it yet.

## Risks

1. **tldraw 4.x → 5.x changes the group/arrow/binding record shape.**
   Probability: medium-low (tldraw 4.x is the current major). Mitigation:
   the `mutator-integration.test.ts` round-trip tests for each variant
   are the canary — they assert the exact record shape ends up in the
   committed snapshot. Failure → block the upgrade until the variants
   are reshaped.

2. **`getPresenceRecords()` is removed or made non-internal-public.**
   Probability: low-medium (the `@internal` marker has been stable
   across recent releases). Mitigation: the readers' integration tests
   read presence directly; structural changes break them first. Plan B
   if removed: fork the relevant tldraw-sync-core helper into the repo
   and pin to the 4.x record shape until a public alternative exists.

3. **Strict validator rejects future arrow-shape props additions.**
   Probability: medium (tldraw adds props periodically — `elbowMidPoint`
   was a recent example). Mitigation: keep the `connectShapes` defaults
   colocated with the variant impl, and update them as a single point
   of change when an upgrade fails the integration test.

## Migration path (when forced)

If a future tldraw version forces a redesign:

1. The integration test fails first with a `mutationFailed` errorKey.
2. The test failure points to the offending variant.
3. Update only the relevant `applyOne` switch arm — caller-facing
   `applyMutation` and `Mutation` discriminated union do not change.

## Alternatives considered

- **Use client-side `editor.groupShapes()` / `editor.createBindings()`
  via a synthetic socket session.** Rejected (also rejected in
  ADR-0013): conceptually wrong — the agent is not a session — and
  brittle to inbound-message format changes.

- **Decline the group/arrow/binding variants in M12.2 and defer to
  a future change once tldraw exposes a higher-level server-side API.**
  Rejected: the agent (M13.1) needs them to draw any non-trivial
  diagram on day one. The acceptance criteria for issue #6 explicitly
  lists all six write variants.

- **Generate arrow defaults dynamically by pulling them from
  `arrowShape.getDefaultProps()` at runtime.** Rejected: that helper
  lives in `@tldraw/tldraw` (the editor package), not `@tldraw/sync-core`
  or `@tldraw/tlschema`. Importing the editor package server-side
  pulls in DOM dependencies. Not worth it for a constant-default
  workaround.

## Consequences

- **Positive:** All six write variants commit cleanly inside the
  existing `commitBatch` path; batch undo semantics from ADR-0013
  apply transparently. Read tools work without HTTP exposure.
- **Negative:** Any tldraw 4.x release that adds a required arrow prop
  will silently break `connectShapes` until the defaults bag is
  updated. The integration test catches this on next CI run, not at
  upgrade time.
- **Tracked elsewhere:** Wire-level broadcast verification still
  blocked by the bun:test happy-dom WebSocket polyfill collision
  (from ADR-0013 — unchanged here; integration tests assert via
  authoritative snapshot, not WS message receipt).
