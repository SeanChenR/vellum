# ADR-0009: Shape edit lock — first-editor-wins via tldraw `editingShapeId` over LWW or CRDT

**Status:** Accepted
**Date:** 2026-05-04
**Decider:** project owner

## Context

Custom shapes (Markdown / Code / Callout / Link card) carry rich text in
their props. tldraw's default sync is last-write-wins: when two users have
the same shape's editor open and both type, whoever blurs second silently
overwrites the other's content. For a "doesn't do anything half-way"
canvas this is unacceptable — but full collaborative text merging (Y.js or
similar) is also too heavy for the M6 milestone, which has 4 shapes to
ship in 1.5 weeks. We need a mid-point that prevents data loss without
adopting CRDT.

## Decision

Adopt **first-editor-wins lock**, derived from tldraw's existing
`editingShapeId` presence field rather than any new server lock table.
A custom hook `useShapeEditLock(shapeId)` in
`apps/web/src/canvas/shapes/use-shape-edit-lock.ts` returns
`{ canEdit, lockedBy }`:

- Local user is the editor → `canEdit: true`
- Another presence has `editingShapeId === shapeId` → `canEdit: false`,
  `lockedBy: { userId, userName }`
- No one is editing → `canEdit: true`

Stale lock fallback: if the locking user's `lastActiveAt` exceeds 5
minutes (heartbeat hasn't ticked, e.g. browser tab frozen), the lock is
ignored. This complements tldraw's built-in presence-disconnect cleanup
(which fires on clean disconnect within seconds).

## Consequences

### Positive

- **Zero new infrastructure** — `editingShapeId` is already broadcast over
  tldraw sync presence. No DB lock table, no server endpoint, no Redis.
- **Predictable UX**: the second editor sees a "locked by ..." badge and
  cannot enter the editor. No silent data loss.
- **Cheap to implement**: a single React hook + a passive badge on each
  shape's view.
- **Doesn't preclude CRDT later**: a future add-realtime-text change can
  layer on top by selectively dropping the lock for shapes whose props
  carry CRDT documents.

### Negative / Trade-offs

- Two users cannot co-edit the same shape simultaneously; markdown / code
  authoring is single-user-at-a-time. Acceptable per PRD scope.
- Stale-lock 5-minute window means a frozen tab can block edits for up to
  5 minutes. Rare in practice; tradeoff for not building heartbeat
  infrastructure.
- Lock is advisory on the client (`isReadonly` is server-enforced for sync
  writes, but the lock badge is purely a client UI affordance — a
  sufficiently determined attacker can patch the client to bypass).
  Acceptable: the worst-case is mutual content loss between two
  cooperating users, not a security boundary.

## Alternatives Considered

### A. Last-write-wins (the default)

Rejected: silent data loss is the failure mode this whole change is
preventing. "Engineering volume is not a cost" — we don't accept LWW just
because it's free.

### B. Y.js / Liveblocks-style CRDT for shape props

Rejected for M6 scope. CRDT is the right answer for true co-editing of
prose, but it requires a separate sync channel for each text field, a new
persistence model (CRDT documents, not jsonb snapshots), and significant
test infrastructure. Estimated effort 3-4× the entire M6 milestone budget.
Revisit in a future Phase 2 "real-time co-editing" change.

### C. Server-side lock table

Rejected: requires new DB schema, new endpoint, new rate-limiting, new
revocation path. Solves no problem the presence-derived lock doesn't, and
introduces a synchronisation surface (lock acquisition vs. presence
heartbeat) that doesn't exist today.
