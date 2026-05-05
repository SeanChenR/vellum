## ADDED Requirements

### Requirement: Sync server flushes snapshots on every mutation via a debounced + cap window writer

In addition to the existing idle-release and graceful-shutdown flush paths, the sync server SHALL flush every dirty canvas's snapshot to the database on a mutation-driven debounce. A `SnapshotPersister` instance with `debounceMs = 2_000` (trailing-edge debounce after the most recent mutation) and `capMs = 10_000` (forced flush within 10 seconds even under continuous activity) SHALL be wired in `apps/api/src/index.ts` as the primary persistence path. Each `TLSocketRoom` created by the room registry SHALL register an `onDataChange` callback that calls `persister.notifyDirty(canvasId, () => room.getCurrentSnapshot())`.

This requirement complements (does NOT replace) the existing idle-release flush in `RoomRegistry.disposeIdle()` and the graceful-shutdown flush in `RoomRegistry.closeAll()`. After this change there are three independent flush paths covering different liveness conditions:

1. **Mutation-driven (this requirement)** — fires within ≤ 10 s during active editing
2. **Idle release** — fires `idleReleaseMs` (60 s) after the last connection drops
3. **Graceful shutdown** — fires once on SIGTERM via `shutdownGracefully`

#### Scenario: continuous editing flushes within the cap window

- **WHEN** a single canvas receives mutations every 1 second for 30 consecutive seconds (no idle gap, no shutdown)
- **THEN** the canvas's `canvases.snapshot` row in Postgres MUST be updated at least 3 times during that window (once per ≤ 10-second cap), and the final `documentClock` value MUST reflect the last mutation within ≤ 12 seconds (cap 10 s + DB latency budget 2 s)

#### Scenario: bursty editing flushes after the trailing-edge debounce

- **WHEN** a canvas receives 5 mutations within 500 ms then no mutations for 3 seconds
- **THEN** Postgres MUST be written exactly once for that burst, between 2.0 s and 2.5 s after the last mutation in the burst (trailing-edge debounce)

#### Scenario: idle release path is preserved

- **WHEN** all sync connections to a canvas drop and the room sits idle for 60 seconds
- **THEN** `RoomRegistry.disposeIdle()` MUST still fire and write the latest snapshot to Postgres exactly once, regardless of whether the mutation-driven persister has already flushed the same state

### Requirement: Graceful shutdown flushes the persister before disposing rooms

`shutdownGracefully(signal)` in `apps/api/src/index.ts` SHALL await `persister.flushAll()` BEFORE awaiting `syncServer.shutdown()` (which calls `RoomRegistry.closeAll()`). This ordering guarantees that any snapshot whose `notifyDirty` was scheduled but whose debounce timer had not yet fired is force-written before rooms are disposed.

If `persister.flushAll()` rejects, the error MUST be logged via the injected logger but the shutdown sequence MUST continue (do not block the shutdown on a failed DB write — the dirty entry stays in `canvases.snapshot` from a previous successful flush, and the operator can investigate the logged error).

#### Scenario: SIGTERM flushes pending debounce before closing rooms

- **WHEN** a canvas has received a mutation 1 second before `SIGTERM` arrives (so the 2 s debounce timer is still pending) and `shutdownGracefully` runs
- **THEN** the persister's pending flush MUST complete (writing to Postgres) BEFORE `syncServer.shutdown()` is awaited; the resulting snapshot MUST contain the mutation

#### Scenario: persister flush failure does not block shutdown

- **WHEN** `persister.flushAll()` rejects (simulated DB outage)
- **THEN** the error MUST be logged AND `syncServer.shutdown()` MUST still be awaited; the process MUST continue toward exit
