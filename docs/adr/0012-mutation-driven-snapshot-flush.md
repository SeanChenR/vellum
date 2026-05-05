# ADR-0012: Mutation-driven snapshot flush — three-path persistence model

**Status:** Accepted
**Date:** 2026-05-05
**Decider:** project owner

## Context

The M4 multiplayer-sync change shipped a `SnapshotPersister`
(debounce + cap window writer) under `apps/api/src/sync/persistence.ts`
with full unit-test coverage in `persistence.test.ts`. But it was never
instantiated in production: `apps/api/src/index.ts` only wired
`saveSnapshotToDb` to `RoomRegistry.opts.saveSnapshot`, which the
registry calls only on two paths:

1. `disposeIdle()` — fires after `idleReleaseMs` (60 s) of zero
   connections
2. `closeAll()` — fires once on graceful shutdown via SIGTERM

Active editing keeps `connectionCount > 0`, so the idle timer never
fires; non-graceful restarts (dev `bun --hot` reload, prod OOM kill,
k8s pod evict, container crash) bypass `closeAll`. Result: every
mutation made between the last graceful flush and the abrupt restart
is permanently lost.

A user-facing data-loss incident occurred during a multiplayer demo
on 2026-05-05: ~10 minutes of grading annotations vanished after a
hot-reload. Postgres `canvases.updated_at` was still at the demo's
start because no flush path had fired during the active editing window.

## Decision

Wire the existing `SnapshotPersister` as a third, mutation-driven
flush path. The production persistence model becomes a layered
defense:

```
                                   trigger                          flush latency
─────────────────────────────────────────────────────────────────────────────────
Mutation-driven (this ADR)         tldraw room.onDataChange          ≤ 10 s
                                   → persister.notifyDirty           (cap window)
                                                                     ≥ 2 s
                                                                     (debounce)
─────────────────────────────────────────────────────────────────────────────────
Idle release (existing)            connectionCount → 0,              60 s after
                                   idle 60 s                         last close
─────────────────────────────────────────────────────────────────────────────────
Graceful shutdown (existing,       SIGTERM/SIGINT →                  ≤ debounce
extended in this ADR)              shutdownGracefully →              + DB write
                                   persister.flushAll → closeAll
```

Implementation:

- A small wiring module `apps/api/src/sync/wiring.ts` exposes two
  pure helpers: `makeTrackingRoomFactory(persister, schema, createRoom)`
  produces a `RoomRegistry.createRoom` factory whose rooms register
  `onDataChange`; `flushThenShutdown(persister, syncShutdown, log)`
  awaits `persister.flushAll()` BEFORE `syncShutdown()` and tolerates
  `flushAll` rejection (logs + continues).
- `apps/api/src/index.ts` instantiates `SnapshotPersister` with
  `debounceMs: 2_000`, `capMs: 10_000`, plugs the wiring helpers in,
  and updates `shutdownGracefully` to use `flushThenShutdown`.

Worst-case data-loss window after this change: **≤ 12 s** (cap 10 s
+ DB write budget 2 s) of in-flight mutations during a non-graceful
restart. Down from "everything since the last graceful flush", which
in active-demo conditions is "the entire demo".

## Consequences

### Positive

- **Data-loss window bounded by `capMs`.** No more "lose the whole
  demo" scenarios under abrupt restart.
- **Three-path defense.** Mutation-driven covers continuous activity,
  idle release covers the post-disconnect tail, graceful shutdown
  covers planned restarts. No single failure class can defeat all three.
- **No new module.** `SnapshotPersister` already existed and was
  tested; this ADR is a wiring change, not a behavior change.
- **Cheap to verify in dev.** Open two browser tabs, edit for 30 s,
  trigger a hot-reload, refresh — observed mutations should persist.
- **Phase-2 cluster path is unchanged.** The wiring touches only the
  in-process composition; the persister itself is single-instance
  scoped (one entry per canvas) — see "Phase 2 upgrade" below.

### Negative / Trade-offs

- **DB write rate increases.** Active editing now writes a snapshot
  every ≤ 10 s instead of once at idle. For Phase 1 (single-instance
  Postgres on Neon, low concurrent canvas count) this is a non-issue:
  10 KB–1 MB jsonb writes every 10 s per active canvas. Phase 2 with
  more canvases or larger snapshots may want a backoff or a partial
  delta flush.
- **A pending debounce timer + an idle timer race on the close edge.**
  After the last connection drops, both the debounce trailing-edge
  and the idle-release path may write the same snapshot once each.
  That's a wasted DB write but not a correctness issue (writes are
  idempotent — same snapshot overwrites itself).
- **`bun --hot` still doesn't trigger SIGTERM.** Mutation-driven flush
  hides the worst symptom but doesn't fully fix dev hot-reload data
  loss for the last < 10 s of edits before reload. Acceptable for
  dev; production deploys via SIGTERM see no loss.

## Phase 2 upgrade points

The single-instance assumption ("one process owns each canvas's
in-memory room") will eventually break:

1. **Multi-instance behind a load balancer.** Two instances handling
   the same canvas → two persisters → write conflicts. Solution
   options:
   - **Sticky routing**: load balancer pins each canvas to one
     instance (consistent hashing or session affinity by canvas id).
       Persister stays single-instance per canvas.
   - **Leader election**: any instance can serve, but only the
     elected leader for that canvas runs the persister; others tail
     via tldraw sync.
   - **Redis-backed persister**: replace the in-memory `Map<canvasId,
     DirtyEntry>` with Redis; debounce timers become Redis EXPIRE
     keys. Higher complexity but no leader election needed.
2. **Large canvases.** Whole-snapshot overwrites at 10 s cadence get
   expensive once snapshots cross ~5 MB. Switch to delta encoding
   (tldraw sync supports op logs) and write deltas every 10 s, with
   a periodic full-snapshot rewrite.
3. **Backoff + alerting.** The current `SnapshotPersister` retries
   on every mutation after a failed flush. For a sustained DB outage
   that's fine in Phase 1 — there's no backoff penalty because
   activity drives retries. Phase 2 wants exponential backoff +
   alerting after N consecutive failures.

These are deferred; the current change is sufficient for Phase 1.

## Alternatives Considered

### A. Lower `idleReleaseMs` to e.g. 5 s

Would tighten the data-loss window for the "user closed the tab and
walked away" case but does NOTHING for "user kept editing for 10 minutes
straight before the server restarted". Doesn't address the actual bug.

### B. Save on every mutation (no debounce)

DB write storm under active editing. Even small snapshots would
generate hundreds of writes per minute. Rejected.

### C. Force `bun --hot` to send SIGTERM

Would let `closeAll` save the day, but it's fighting the dev tool —
even if we could (we can't, AFAICT bun --hot is module-level reload),
production OOM kills / pod evicts / crashes still bypass SIGTERM.
Doesn't address the underlying problem.

### D. Stop using `bun --hot` in dev

Dev productivity loss without addressing the production failure modes.
Rejected.
