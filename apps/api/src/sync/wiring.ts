/**
 * Sync persistence wiring helpers.
 *
 * Two pure helpers that bridge the existing `SnapshotPersister`
 * (debounce + cap window writer) into the production sync server.
 * Kept in a separate module from `apps/api/src/index.ts` so the wiring
 * logic is unit-testable without instantiating Bun.serve, Postgres, or
 * a real `TLSocketRoom`.
 *
 * Spec: multiplayer-sync —
 *   "Sync server flushes snapshots on every mutation via a debounced
 *    + cap window writer"
 *   "Graceful shutdown flushes the persister before disposing rooms"
 */

import type { RoomSnapshot } from "@tldraw/sync-core";

// ---------------------------------------------------------------------------
// Minimal shapes — kept narrow so tests don't need a full TLSocketRoom.
// ---------------------------------------------------------------------------

export interface PersisterLike {
  notifyDirty(canvasId: string, getSnapshot: () => RoomSnapshot): void;
}

export interface PersisterFlushAllLike {
  flushAll(): Promise<void>;
}

export interface RoomLike {
  getCurrentSnapshot(): RoomSnapshot;
}

/** Schema is opaque to wiring — it's just forwarded to TLSocketRoom. */
export type SchemaLike = unknown;

export interface CreateTLSocketRoomOpts<R extends RoomLike> {
  initialSnapshot: RoomSnapshot | undefined;
  schema: SchemaLike;
  onDataChange: () => void;
}

export type CreateTLSocketRoom<R extends RoomLike> = (opts: CreateTLSocketRoomOpts<R>) => R;

export interface ShutdownLogger {
  error(meta: unknown, msg: string): void;
}

// ---------------------------------------------------------------------------
// makeTrackingRoomFactory — produces a (canvasId, initialSnapshot) → room
// factory whose rooms call `persister.notifyDirty` on every mutation.
// ---------------------------------------------------------------------------

/**
 * Build a room factory for `RoomRegistry.createRoom`. Each room gets an
 * `onDataChange` callback that reports the canvas as dirty to the
 * persister; the persister then handles debounce + cap-window flushes.
 *
 * The closure binds `room` after `createRoom` returns it; `onDataChange`
 * fires only on later mutations, so the binding is always populated by
 * the time it is read.
 */
export function makeTrackingRoomFactory<R extends RoomLike>(
  persister: PersisterLike,
  schema: SchemaLike,
  createRoom: CreateTLSocketRoom<R>,
): (canvasId: string, initialSnapshot: RoomSnapshot | undefined) => R {
  return (canvasId, initialSnapshot) => {
    const room: R = createRoom({
      initialSnapshot,
      schema,
      onDataChange: () => {
        persister.notifyDirty(canvasId, () => room.getCurrentSnapshot());
      },
    });
    return room;
  };
}

// ---------------------------------------------------------------------------
// flushThenShutdown — graceful-shutdown ordering helper
// ---------------------------------------------------------------------------

/**
 * Awaits `persister.flushAll()` BEFORE `syncShutdown()`. If `flushAll`
 * rejects, the error is logged but `syncShutdown` is still invoked so
 * the process can continue toward exit. Errors from `syncShutdown`
 * itself propagate to the caller (the outer `shutdownGracefully`
 * already wraps the whole sequence in try/catch).
 */
export async function flushThenShutdown(
  persister: PersisterFlushAllLike,
  syncShutdown: () => Promise<void>,
  log: ShutdownLogger,
): Promise<void> {
  try {
    await persister.flushAll();
  } catch (err) {
    log.error({ err }, "snapshot persister flushAll failed during shutdown");
  }
  await syncShutdown();
}
