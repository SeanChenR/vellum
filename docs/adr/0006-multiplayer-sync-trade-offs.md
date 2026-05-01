# ADR-0006: Multiplayer sync — crash recovery boundary and single-process room registry

**Status:** Accepted
**Date:** 2026-05-01
**Decider:** project owner

## Context

M4 introduces real-time multiplayer for canvas editing using `@tldraw/sync`
hosted on the existing Bun.serve process. Two architectural choices that
affect ops behaviour and future scaling deserve to be recorded explicitly so
future contributors (and Claude sessions) do not relitigate them silently:

1. **Crash recovery boundary.** Snapshots are flushed to Postgres on a 2 s
   debounce + 10 s cap from when a room becomes dirty. Therefore any
   non-graceful server termination (SIGKILL, OOM, panic) loses up to ~10 s
   of in-flight edits.
2. **Room registry topology.** Rooms live in an in-memory `Map<canvasId,
   Room>` inside one Bun process. There is no cross-process coordination —
   if the same canvas were ever opened from connections landing on
   different processes, they would diverge.

## Decision

We accept both trade-offs for Phase 1:

- The 2 s / 10 s flush schedule stands; no incremental persistence layer is
  added in Phase 1.
- The room registry is single-process. The HTTP `PATCH /api/canvas/:id`
  snapshot path returns `409 errors.canvas.activeRoom` while a room is open,
  which is correct for single-process and intentionally conservative — it
  also blocks any Phase 2 stale write that might come from a different
  worker before we have a coordination layer.

## Consequences

### Positive

- Implementation fits in a single Bun.serve process — no Redis, no separate
  sync service, no extra ops surface.
- Flush cadence is a known knob (constants `debounceMs` / `capMs` in
  `apps/api/src/sync/persistence.ts`) and easy to tune later.
- The 409 active-room gate makes the data-integrity contract explicit;
  Phase 2 worker rollouts can be designed against the same predicate.

### Negative / Trade-offs

- **Up to 10 s of edits lost on hard crash.** Phase 2 should re-evaluate
  by either (a) tightening `capMs` once load is understood, or (b) adding
  a write-ahead log (incremental jsonb patches) so the cap can be lowered
  without DB-write storms.
- **No horizontal scaling without coordination.** Rolling out a second Bun
  process today would require sticky routing per canvas (not implemented).
  Phase 2 hosting decision (see ADR-0004) MUST address this before adding a
  second worker — the simplest fix is Redis pub/sub for room ownership +
  message fan-out.

## Alternatives Considered

### A. Per-op writes (no debounce)

Rejected. High-frequency op streams (continuous brush strokes) would
generate dozens of Postgres writes per second per canvas. Costs scale
linearly with active editor count and the marginal durability gain is
small versus the 2 s debounce.

### B. Idle-only flush (only on room dispose)

Rejected. A 60 s idle release window would let crashes lose up to ~60 s of
edits — over 6× the current ceiling — for marginal write savings on small
canvases.

### C. Multi-process from day one (Redis or a sync service)

Rejected as Phase 1 scope. Adds an external dependency, more surface area
to monitor, and complicates the single-binary deploy that ADR-0001
deliberately optimises for. Phase 2 can layer it in once we have any
deployment topology at all (current state: still localhost-only per
ADR-0004).
