/**
 * Snapshot persistence — server-authoritative debounced flush of room state.
 *
 * For each canvas we keep at most one pending debounce timer. The cadence is:
 *   - Trailing-edge debounce: write 2 seconds after the most recent op
 *   - Cap window: even under continuous activity, force a flush within 10
 *     seconds of the previous successful flush
 *
 * On DB write failure we log via the injected logger and KEEP the canvas
 * dirty so the next debounce or cap window retries.
 *
 * Design: "Snapshot 持久化：debounce 寫入時機與重啟還原"
 */

import type { RoomSnapshot } from "@tldraw/sync-core";

export type TimerHandle = unknown;

export interface SnapshotLogger {
  error(meta: unknown, msg: string): void;
}

export interface SnapshotPersisterOptions {
  saveSnapshot(canvasId: string, snapshot: RoomSnapshot): Promise<void>;
  setTimer(fn: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
  now(): number;
  log: SnapshotLogger;
  /** Trailing-edge debounce in ms. Production: 2_000. */
  debounceMs: number;
  /** Cap window in ms. Production: 10_000. */
  capMs: number;
}

interface DirtyEntry {
  /** Pulls the current snapshot at flush time (always freshest state). */
  getSnapshot: () => RoomSnapshot;
  /** Pending debounce timer; null while a flush is in flight. */
  timer: TimerHandle | null;
  /** Wall-clock time at which this entry became dirty (start of the cap window). */
  dirtyStartedAt: number;
  /** True while a flush is awaiting saveSnapshot's promise. */
  flushing: boolean;
}

export class SnapshotPersister {
  readonly #opts: SnapshotPersisterOptions;
  readonly #entries = new Map<string, DirtyEntry>();

  constructor(opts: SnapshotPersisterOptions) {
    this.#opts = opts;
  }

  /**
   * Mark a canvas dirty. Schedules a trailing-edge debounce; if the time
   * since the last flush exceeds the cap window, the timer is shortened so
   * the flush still happens within `capMs` of the previous flush.
   */
  notifyDirty(canvasId: string, getSnapshot: () => RoomSnapshot): void {
    const now = this.#opts.now();
    let entry = this.#entries.get(canvasId);
    if (!entry) {
      entry = {
        getSnapshot,
        timer: null,
        dirtyStartedAt: now,
        flushing: false,
      };
      this.#entries.set(canvasId, entry);
    } else {
      entry.getSnapshot = getSnapshot;
    }

    if (entry.timer !== null) {
      this.#opts.clearTimer(entry.timer);
      entry.timer = null;
    }

    // Trailing-edge debounce competes with the cap window measured from
    // when the entry became dirty. Whichever expires first wins.
    const debounceExpiry = now + this.#opts.debounceMs;
    const capExpiry = entry.dirtyStartedAt + this.#opts.capMs;
    const fireAt = Math.min(debounceExpiry, capExpiry);
    const delay = Math.max(0, fireAt - now);

    entry.timer = this.#opts.setTimer(() => {
      void this.#flushEntry(canvasId);
    }, delay);
  }

  /**
   * Force an immediate flush for a single canvas, cancelling its pending
   * debounce. No-op if the canvas is clean.
   */
  async flush(canvasId: string): Promise<void> {
    const entry = this.#entries.get(canvasId);
    if (!entry) return;
    if (entry.timer !== null) {
      this.#opts.clearTimer(entry.timer);
      entry.timer = null;
    }
    await this.#runFlush(canvasId, entry);
  }

  /** Flush every dirty canvas — for graceful shutdown. */
  async flushAll(): Promise<void> {
    const ids = Array.from(this.#entries.keys());
    await Promise.all(ids.map((id) => this.flush(id)));
  }

  // -------------------------------------------------------------------------

  async #flushEntry(canvasId: string): Promise<void> {
    const entry = this.#entries.get(canvasId);
    if (!entry) return;
    entry.timer = null;
    await this.#runFlush(canvasId, entry);
  }

  async #runFlush(canvasId: string, entry: DirtyEntry): Promise<void> {
    if (entry.flushing) return;
    entry.flushing = true;
    const snapshot = entry.getSnapshot();
    try {
      await this.#opts.saveSnapshot(canvasId, snapshot);
      // Successful flush — drop the entry; further notifyDirty will recreate it.
      this.#entries.delete(canvasId);
    } catch (err) {
      this.#opts.log.error(
        { err, canvasId },
        "snapshot flush failed; will retry on next debounce or cap window",
      );
      // Keep the original `dirtyStartedAt` so the cap window is still treated
      // as expired — the next notifyDirty SHALL fire an immediate retry
      // (delay=0). For a persistent DB outage activity will drive retries on
      // every op; that is acceptable for phase 1 without backoff.
    } finally {
      const stillThere = this.#entries.get(canvasId);
      if (stillThere) stillThere.flushing = false;
    }
  }
}
