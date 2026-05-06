# ADR-0013: Server tldraw Mutator — TLSocketRoom write entry point

**Status:** Accepted
**Date:** 2026-05-06
**Decider:** project owner
**Context change:** [`add-server-tldraw-mutator`](../../openspec/changes/archive/) (M12.1)

## Context

Phase 2 introduces an AI agent that operates on canvases from the server
side. The agent has no WebSocket connection to its own room; mutations
have to be applied **outside** the normal client→server WS flow but
still land in the room's authoritative state and broadcast to every
connected client through the existing tldraw sync pipeline.

Phase 1's sync server (`apps/api/src/sync/index.ts` + `room.ts`) is a
thin wrapper around `@tldraw/sync-core`'s `TLSocketRoom`. Every Phase 1
write originates from `room.handleSocketMessage` — the inbound message
hook. M12.1 (Server tldraw Mutator) adds a parallel write path:

```
agent / dev REST  →  applyMutation(canvasId, mutations[])
                        ↓
                  TLSocketRoom write API (this ADR's subject)
                        ↓
                  storage.transaction commit
                        ↓
                  TLSyncRoom.broadcastExternalStorageChanges
                        ↓
                  broadcast to all sessions (WS clients)
```

The question this ADR records: **which TLSocketRoom write API do we
adopt for that second arrow?**

## Candidate APIs

`@tldraw/sync-core@4.5.10` exposes three plausible entry points:

1. **`room.updateStore(updater)`** — public, marked `@deprecated` in
   favour of `storage.transaction`. Accepts an updater fn that receives
   a `RoomStoreMethods<R>` (`get` / `put`); collects writes into a
   `StoreUpdateContext` and commits via a single `storage.transaction`.
2. **`storage.transaction(updater)`** — the recommended replacement.
   Lower-level: caller manipulates the storage txn directly without the
   `RoomStoreMethods` schema-validating wrapper.
3. **Synthetic "server session" via `room.handleSocketMessage`** —
   construct a fake `MessageEvent` and pump it through the inbound
   hook. Maximum impedance with the rest of the system; no batch
   semantics, no schema-validating helpers.

## Decision

**Adopt `room.updateStore(updater)` for M12.1.** Reject (3) outright.
Defer the migration to (2) until either:

- a tldraw-sync release removes `updateStore`, or
- M12.2 surfaces a need for finer-grained transaction control that
  `updateStore`'s wrapper does not give us.

`updateStore` is the single-call surface that:

- runs schema validation on each `put` via `recordType.validate(...)` —
  free defence against malformed shape records sent through the agent
- collects all writes inside one `storage.transaction` — the property
  this ADR pins (single broadcast, single client-side undo entry per
  `applyMutation` call)
- mirrors the API shape that the agent runtime in M13 will consume —
  no caller refactor when we eventually port to `storage.transaction`

The `@deprecated` marker is documented in the JSDoc with no removal
date or migration timeline. It is therefore a soft deprecation: the
function works, has tests in `@tldraw/sync-core`, and the migration
path is mechanical when forced.

## Batch semantics — preservation across the bridge

Server-side: `applyMutation([A, B])` calls `updateStore(store => { store.put(A); store.put(B); })`. The wrapper writes both to one
`StoreUpdateContext.updates.puts` map and commits via a single
`storage.transaction`. tldraw's `TLSyncRoom` listens to
`storage.onChange` once per transaction and emits one `broadcastPatch`,
not two.

Client-side: a single broadcast becomes a single editor operation,
which is collapsed into a single undo entry — preserving PRD US 12
(Cmd+Z reverts the entire AI turn).

The integration test in
`apps/api/src/sync/mutator-integration.test.ts` validates this by
checking that a 2-shape `applyMutation` results in one snapshot
containing both records.

## Wire-level broadcast verification — known test-environment gap

The integration test asserts on the room's authoritative snapshot
post-mutation. It does **not** assert that a connected `WebSocket`
client physically receives a `message` event — the bun:test preload
registers happy-dom globally, which patches `globalThis.WebSocket`,
`globalThis.fetch`, and other transport globals with DOM-aware
implementations that do not interoperate cleanly with Bun.serve's
native upgrade path. Even after `GlobalRegistrator.unregister()` for
the test file, downstream tldraw-sync internals had captured the
patched constructors before the unregister fired.

Wire-level verification is recorded against task 10.4 of the change
(manual visual smoke: `curl POST /dev/canvas/:id/mutate` while a
browser is open on the canvas, observe the shape appear). Phase 2 may
revisit this by either (a) splitting the test preload so server-side
test files opt out of happy-dom, or (b) adding a Playwright E2E test
in M14 that exercises the same path through a real browser.

## Risks

1. **`updateStore` removal in a future tldraw-sync version.** Risk
   tier: low-to-medium. Mitigation: the `commitBatch` helper in
   `apps/api/src/sync/mutator.ts` is the only caller of `updateStore`
   in the entire codebase, so the migration to `storage.transaction`
   is a single-function refactor. The mutator's unit tests use a
   `MutatorRoom` interface that already abstracts the call, so the
   public `applyMutation` API does not break.

2. **`storage.transaction` semantics drift from `updateStore`.** Risk
   tier: low. The deprecation note explicitly says "use
   `storage.transaction` instead", implying behavioural equivalence.
   When we migrate, the integration test should still pass without
   modification — that is the canary.

3. **Schema validation in `StoreUpdateContext.put` runs against the
   *current* room snapshot.** Concurrent client writes between
   `applyMutation`'s start and commit could in principle invalidate
   the validation precondition. Risk tier: low. tldraw-sync runs
   validations under the same room lock used by client-driven writes;
   no observed race in the spike. M12.2 will revisit if real-world
   testing surfaces issues.

4. **Broadcast pipeline changes.** If a future tldraw-sync release
   moves the broadcast trigger off `storage.onChange` (e.g., to
   `room.broadcastPatch` direct calls), our `updateStore`-based path
   could silently stop broadcasting. Canary: the integration test
   must continue to pass when `@tldraw/sync-core` is upgraded; if it
   regresses post-upgrade, fall back to wiring through
   `storage.transaction` directly + an explicit `room.broadcastPatch`
   call before merging the upgrade.

## Migration path (when forced)

```
// Before (M12.1)
await room.updateStore((store) => {
  for (const op of ops) applyOne(store, op);
});

// After (when updateStore is removed)
room.storage.transaction((txn) => {
  for (const op of ops) {
    const record = buildRecord(op);
    schema.types[record.typeName]?.validate(record);
    txn.set(record.id, record);
  }
});
```

The mutator's caller-facing API does not change.

## Alternatives considered

- **Adopt `storage.transaction` immediately.** Would future-proof but
  loses the schema-validating wrapper and adds bookkeeping the spike
  does not need. Re-evaluate at M12.2 once the full tool surface
  (updateShape, deleteShape, groupShapes, connectShapes) is in scope.
- **Synthetic-session via `handleSocketMessage`.** Rejected: no batch
  semantics, no schema validation, brittle to inbound-message format
  changes, and conceptually wrong (the agent is not a session).

## Consequences

- **Positive:** Simple impl, validated end-to-end via unit + integration
  tests, single-function migration when forced.
- **Negative:** Linter-flagged deprecated API in `mutator.ts` (silenced
  with the standard project comment); needs a watch on each tldraw-sync
  upgrade.
- **Tracked elsewhere:** Wire-level broadcast verification in test
  environment — see task 10.4 and the test-environment gap section
  above.
