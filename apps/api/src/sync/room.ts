/**
 * Room registry — owns the Map<canvasId, TLSocketRoom> for the sync server.
 *
 * Responsibilities:
 *   - Lazy create + DB-hydrate on first acquire(canvasId)
 *   - Track per-canvas open-connection count (separate from the per-user-canvas
 *     concurrent counter in `rate-limit.ts`)
 *   - Schedule a 60-second idle timer when the count drops to zero;
 *     cancel it if a new acquire arrives during the idle window
 *   - On idle expiry: flush dirty snapshot to DB → dispose room → drop entry
 *
 * The TLSocketRoom factory is dependency-injected so unit tests can substitute
 * a lightweight stub (`SyncRoomLike`).
 *
 * Design: "tldraw Sync Server 架構" + "Room 生命週期與 idle 釋放策略"
 */

import type { RoomSnapshot, WebSocketMinimal } from "@tldraw/sync-core";

/**
 * Minimal room interface the registry needs. The real `TLSocketRoom` satisfies
 * this; tests pass small objects with just these methods.
 *
 * The `handleSocket*` methods are part of the contract because the sync
 * server's WebSocket lifecycle hooks call them; tests for index.ts stub them
 * out, registry-level tests can omit them via the optional marker.
 */
export interface SyncRoomLike {
  getCurrentSnapshot(): RoomSnapshot;
  isClosed(): boolean;
  close(): void;
  handleSocketConnect?(opts: {
    sessionId: string;
    socket: WebSocketMinimal;
    isReadonly?: boolean;
  }): void;
  handleSocketMessage?(sessionId: string, message: string): void;
  handleSocketClose?(sessionId: string): void;
}

/** Opaque timer handle — tests pass numbers; production passes Timer objects. */
export type TimerHandle = unknown;

export interface RoomRegistryOptions<R extends SyncRoomLike> {
  createRoom(canvasId: string, initialSnapshot: RoomSnapshot | undefined): R;
  loadSnapshot(canvasId: string): Promise<RoomSnapshot | undefined>;
  saveSnapshot(canvasId: string, snapshot: RoomSnapshot): Promise<void>;
  setTimer(fn: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
  /** Idle release timeout in ms. Production: 60_000. */
  idleReleaseMs: number;
}

interface RoomEntry<R extends SyncRoomLike> {
  room: R;
  count: number;
  /** Pending idle-release timer; null while count > 0 or while the timer fired. */
  idleTimer: TimerHandle | null;
}

export class RoomRegistry<R extends SyncRoomLike = SyncRoomLike> {
  readonly #opts: RoomRegistryOptions<R>;
  readonly #entries = new Map<string, RoomEntry<R>>();
  /** Pending acquire promises so concurrent acquire() calls share one hydrate. */
  readonly #pending = new Map<string, Promise<R>>();

  constructor(opts: RoomRegistryOptions<R>) {
    this.#opts = opts;
  }

  /**
   * Get-or-create the room for `canvasId`, increment its connection count,
   * and cancel any pending idle timer. The first call for a given id triggers
   * a single `loadSnapshot` against the DB.
   */
  async acquire(canvasId: string): Promise<R> {
    const existing = this.#entries.get(canvasId);
    if (existing) {
      this.#cancelIdleTimer(existing);
      existing.count += 1;
      return existing.room;
    }

    const inflight = this.#pending.get(canvasId);
    if (inflight) {
      const room = await inflight;
      const entry = this.#entries.get(canvasId);
      if (entry) {
        this.#cancelIdleTimer(entry);
        entry.count += 1;
      }
      return room;
    }

    const promise = (async () => {
      const snapshot = await this.#opts.loadSnapshot(canvasId);
      const room = this.#opts.createRoom(canvasId, snapshot);
      this.#entries.set(canvasId, { room, count: 0, idleTimer: null });
      return room;
    })();

    this.#pending.set(canvasId, promise);
    try {
      const room = await promise;
      const entry = this.#entries.get(canvasId);
      if (entry) {
        this.#cancelIdleTimer(entry);
        entry.count += 1;
      }
      return room;
    } finally {
      this.#pending.delete(canvasId);
    }
  }

  /**
   * Decrement the connection count for `canvasId`. When the count reaches
   * zero, schedule the idle-release timer.
   */
  release(canvasId: string): void {
    const entry = this.#entries.get(canvasId);
    if (!entry) return;
    if (entry.count <= 0) return; // defensive — never go negative
    entry.count -= 1;
    if (entry.count === 0) {
      entry.idleTimer = this.#opts.setTimer(() => {
        this.#disposeIdle(canvasId);
      }, this.#opts.idleReleaseMs);
    }
  }

  getConnectionCount(canvasId: string): number {
    return this.#entries.get(canvasId)?.count ?? 0;
  }

  getRoom(canvasId: string): R | undefined {
    return this.#entries.get(canvasId)?.room;
  }

  /**
   * Force-dispose a single canvas's room without waiting for the idle timer.
   * Set `flush: false` when the canvas itself is being deleted so we do not
   * waste a write to a row that is about to disappear.
   */
  async disposeRoom(canvasId: string, opts: { flush?: boolean } = {}): Promise<void> {
    const entry = this.#entries.get(canvasId);
    if (!entry) return;
    this.#cancelIdleTimer(entry);
    const shouldFlush = opts.flush ?? true;
    if (shouldFlush) {
      try {
        await this.#opts.saveSnapshot(canvasId, entry.room.getCurrentSnapshot());
      } catch {
        // Swallow — caller has already decided this snapshot is no longer load-bearing.
      }
    }
    try {
      if (!entry.room.isClosed()) entry.room.close();
    } finally {
      this.#entries.delete(canvasId);
    }
  }

  /**
   * Graceful shutdown — flush + dispose every room. Cancels any pending
   * idle timers so they cannot fire after disposal.
   */
  async closeAll(): Promise<void> {
    const ids = Array.from(this.#entries.keys());
    for (const id of ids) {
      const entry = this.#entries.get(id);
      if (!entry) continue;
      this.#cancelIdleTimer(entry);
    }
    await Promise.all(
      ids.map(async (id) => {
        const entry = this.#entries.get(id);
        if (!entry) return;
        await this.#flushAndDispose(id, entry);
      }),
    );
  }

  // -------------------------------------------------------------------------

  #cancelIdleTimer(entry: RoomEntry<R>): void {
    if (entry.idleTimer !== null) {
      this.#opts.clearTimer(entry.idleTimer);
      entry.idleTimer = null;
    }
  }

  async #disposeIdle(canvasId: string): Promise<void> {
    const entry = this.#entries.get(canvasId);
    if (!entry) return;
    // Idle timer fired; clear handle even though it has already executed.
    entry.idleTimer = null;
    if (entry.count > 0) return; // raced with a new acquire — abort dispose
    await this.#flushAndDispose(canvasId, entry);
  }

  async #flushAndDispose(canvasId: string, entry: RoomEntry<R>): Promise<void> {
    try {
      const snapshot = entry.room.getCurrentSnapshot();
      await this.#opts.saveSnapshot(canvasId, snapshot);
    } finally {
      try {
        if (!entry.room.isClosed()) entry.room.close();
      } finally {
        this.#entries.delete(canvasId);
      }
    }
  }
}
