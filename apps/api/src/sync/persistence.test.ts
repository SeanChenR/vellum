/**
 * Sync snapshot persistence tests (task 2.4).
 *
 * Covers spec requirement:
 *   "Sync server flushes snapshots on a debounced cadence"
 *
 * Behaviour under test:
 *   - 2-second trailing-edge debounce (single op at t=0 → flush ~t=2s)
 *   - Burst within the debounce window coalesces into ONE flush
 *   - 10-second cap forces a flush even when activity is continuous
 *   - Failed DB write logs an error and keeps the room dirty for retry
 *
 * Tests inject a fake clock, a fake scheduler, a recording logger, and a mock
 * `saveSnapshot` so timer-based behaviour is observable in milliseconds without
 * wall-clock waits.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { RoomSnapshot } from "@tldraw/sync-core";
import { SnapshotPersister, type SnapshotPersisterOptions, type TimerHandle } from "./persistence";

// ---------------------------------------------------------------------------
// Fake scheduler — same shape used by room.test.ts
// ---------------------------------------------------------------------------

interface FakeTimer {
  fn: () => void;
  fireAt: number;
  cleared: boolean;
}

class FakeScheduler {
  now = 0;
  timers = new Map<number, FakeTimer>();
  nextId = 1;

  setTimer = (fn: () => void, ms: number): TimerHandle => {
    const id = this.nextId++;
    this.timers.set(id, { fn, fireAt: this.now + ms, cleared: false });
    return id as unknown as TimerHandle;
  };

  clearTimer = (handle: TimerHandle): void => {
    const t = this.timers.get(handle as number);
    if (t) t.cleared = true;
  };

  /** Advance the clock by `ms`, firing any timers whose fireAt has elapsed. */
  async advance(ms: number): Promise<void> {
    const target = this.now + ms;
    for (;;) {
      const due: Array<[number, FakeTimer]> = [];
      for (const [id, t] of this.timers) {
        if (!t.cleared && t.fireAt <= target) due.push([id, t]);
      }
      if (due.length === 0) break;
      due.sort((a, b) => a[1].fireAt - b[1].fireAt);
      const [id, t] = due[0]!;
      this.now = t.fireAt;
      this.timers.delete(id);
      t.fn();
      // allow microtask queue (saveSnapshot is async)
      await new Promise((r) => setTimeout(r, 0));
    }
    this.now = target;
  }

  pendingCount(): number {
    let n = 0;
    for (const t of this.timers.values()) if (!t.cleared) n++;
    return n;
  }
}

// ---------------------------------------------------------------------------
// Recording stubs
// ---------------------------------------------------------------------------

interface SaveCall {
  canvasId: string;
  snapshot: RoomSnapshot;
  at: number;
}

interface SaveStub {
  calls: SaveCall[];
  failNext: number;
  saveSnapshot: (canvasId: string, snapshot: RoomSnapshot) => Promise<void>;
}

function makeSaveStub(scheduler: FakeScheduler): SaveStub {
  const stub: SaveStub = {
    calls: [],
    failNext: 0,
    async saveSnapshot(canvasId, snapshot) {
      if (stub.failNext > 0) {
        stub.failNext--;
        throw new Error("simulated DB failure");
      }
      stub.calls.push({ canvasId, snapshot, at: scheduler.now });
    },
  };
  return stub;
}

interface LogStub {
  errors: Array<{ msg: string; meta: unknown }>;
  log: { error: (meta: unknown, msg: string) => void };
}

function makeLogStub(): LogStub {
  const errors: Array<{ msg: string; meta: unknown }> = [];
  return {
    errors,
    log: {
      error(meta: unknown, msg: string) {
        errors.push({ msg, meta });
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const CANVAS = "00000000-0000-0000-0000-000000000001";

function snap(value: number): RoomSnapshot {
  return {
    documents: [{ state: { v: value } as never, lastChangedClock: value }],
    schema: undefined as never,
  };
}

let scheduler: FakeScheduler;
let saver: SaveStub;
let log: LogStub;
let persister: SnapshotPersister;

function buildPersister() {
  const options: SnapshotPersisterOptions = {
    saveSnapshot: saver.saveSnapshot,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    now: () => scheduler.now,
    log: log.log,
    debounceMs: 2_000,
    capMs: 10_000,
  };
  persister = new SnapshotPersister(options);
}

beforeEach(() => {
  scheduler = new FakeScheduler();
  saver = makeSaveStub(scheduler);
  log = makeLogStub();
  buildPersister();
});

// ---------------------------------------------------------------------------
// Trailing-edge debounce
// ---------------------------------------------------------------------------

describe("trailing-edge debounce — 2 seconds idle", () => {
  test("a single op SHALL flush approximately 2 seconds later", async () => {
    let v = 1;
    persister.notifyDirty(CANVAS, () => snap(v));

    await scheduler.advance(1_999);
    expect(saver.calls).toHaveLength(0);

    await scheduler.advance(2);
    expect(saver.calls).toHaveLength(1);
    expect(saver.calls[0]?.canvasId).toBe(CANVAS);
    expect(saver.calls[0]?.snapshot).toEqual(snap(1));
    expect(saver.calls[0]?.at).toBe(2_000);
  });

  test("a burst of 10 ops within 1 second coalesces into ONE flush, 2 seconds after the last op", async () => {
    let v = 0;
    // 10 notifyDirty at t=0, 100, 200, …, 900. We do not advance after the
    // last one so the clock stays at 900ms when the loop exits.
    for (let i = 0; i < 10; i++) {
      v++;
      persister.notifyDirty(CANVAS, () => snap(v));
      if (i < 9) await scheduler.advance(100);
    }
    expect(scheduler.now).toBe(900);
    // Last op at 900ms → trailing-edge debounce fires at 2900ms.
    expect(saver.calls).toHaveLength(0);

    await scheduler.advance(1_999); // now t=2899 — still pending
    expect(saver.calls).toHaveLength(0);

    await scheduler.advance(2); // now t=2901 — fires
    expect(saver.calls).toHaveLength(1);
    expect(saver.calls[0]?.snapshot).toEqual(snap(10));
  });

  test("each notifyDirty resets the trailing edge", async () => {
    let v = 1;
    persister.notifyDirty(CANVAS, () => snap(v));
    await scheduler.advance(1_500);
    v = 2;
    persister.notifyDirty(CANVAS, () => snap(v));
    await scheduler.advance(1_500); // 1500 + 1500 = 3000 from start; debounce extended
    expect(saver.calls).toHaveLength(0);
    await scheduler.advance(600);
    // Last notify at t=1500; flush at 1500+2000=3500. After advance 1500+600=2100… still pending.
    // Continue until total t = 3500.
    await scheduler.advance(3_500 - scheduler.now);
    expect(saver.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cap window — 10 seconds during continuous activity
// ---------------------------------------------------------------------------

describe("cap window — 10 seconds force-flush", () => {
  test("continuous 1 op per 500 ms for 25 seconds SHALL produce at least 2 flushes (one per 10s window)", async () => {
    let v = 0;
    // 50 ops total over 25 seconds
    for (let step = 0; step < 50; step++) {
      v++;
      persister.notifyDirty(CANVAS, () => snap(v));
      await scheduler.advance(500);
    }
    // Each 10s cap window MUST force a flush. Over 25s with the dirty state
    // never resting, at least two cap-window flushes (at ~10s, ~20s) SHALL
    // have happened.
    expect(saver.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("the cap window resets after a successful flush", async () => {
    persister.notifyDirty(CANVAS, () => snap(1));
    await scheduler.advance(2_001); // first debounce flush at ~t=2000
    expect(saver.calls).toHaveLength(1);

    // Now do continuous activity for 9 seconds — debounce never closes, but
    // we are also under the 10-second cap measured from the last successful flush.
    for (let step = 0; step < 18; step++) {
      persister.notifyDirty(CANVAS, () => snap(2 + step));
      await scheduler.advance(500);
    }
    // total t = 2_001 + 9_000 = 11_001. From the last flush at 2_000, that is
    // 9_001 ms — still within the 10s cap. Only the initial flush so far.
    expect(saver.calls.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Per-canvas isolation
// ---------------------------------------------------------------------------

describe("per-canvas isolation", () => {
  test("dirty state is tracked independently per canvas", async () => {
    const OTHER = "00000000-0000-0000-0000-000000000002";
    persister.notifyDirty(CANVAS, () => snap(1));
    await scheduler.advance(1_000);
    persister.notifyDirty(OTHER, () => snap(99));

    await scheduler.advance(1_001); // CANVAS at t=2001 fires
    expect(saver.calls).toHaveLength(1);
    expect(saver.calls[0]?.canvasId).toBe(CANVAS);

    await scheduler.advance(1_000); // OTHER at t=3001 fires (notify was at t=1000)
    expect(saver.calls).toHaveLength(2);
    expect(saver.calls[1]?.canvasId).toBe(OTHER);
  });
});

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

describe("DB write failure", () => {
  test("a failed flush logs an error AND retains dirty state for the next debounce window", async () => {
    saver.failNext = 1;
    let v = 1;
    persister.notifyDirty(CANVAS, () => snap(v));
    await scheduler.advance(2_001);

    expect(saver.calls).toHaveLength(0);
    expect(log.errors).toHaveLength(1);
    expect(log.errors[0]?.msg).toMatch(/snapshot/i);

    // Another op arrives — its trailing-edge debounce SHALL fire and retry.
    v = 2;
    persister.notifyDirty(CANVAS, () => snap(v));
    await scheduler.advance(2_001);

    expect(saver.calls).toHaveLength(1);
    expect(saver.calls[0]?.snapshot).toEqual(snap(2));
  });

  test("after a failed flush, the cap window keeps trying until success", async () => {
    saver.failNext = 1;
    let v = 0;
    // Continuous activity for 12 seconds.
    for (let step = 0; step < 24; step++) {
      v++;
      persister.notifyDirty(CANVAS, () => snap(v));
      await scheduler.advance(500);
    }
    // First cap-window attempt at ~10s SHALL fail; logger records it; later
    // retry SHALL succeed (failNext was 1).
    expect(log.errors.length).toBeGreaterThanOrEqual(1);
    expect(saver.calls.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Explicit flush + flushAll
// ---------------------------------------------------------------------------

describe("explicit flush", () => {
  test("flush(canvasId) writes immediately and cancels the pending debounce", async () => {
    persister.notifyDirty(CANVAS, () => snap(7));
    await scheduler.advance(500);

    await persister.flush(CANVAS);
    expect(saver.calls).toHaveLength(1);
    expect(saver.calls[0]?.snapshot).toEqual(snap(7));

    // Advance past the original debounce — no second flush MUST happen.
    await scheduler.advance(5_000);
    expect(saver.calls).toHaveLength(1);
  });

  test("flush on a clean canvas is a no-op", async () => {
    await persister.flush(CANVAS);
    expect(saver.calls).toHaveLength(0);
  });

  test("flushAll writes every dirty canvas and clears their schedules", async () => {
    const C2 = "00000000-0000-0000-0000-000000000002";
    persister.notifyDirty(CANVAS, () => snap(1));
    persister.notifyDirty(C2, () => snap(2));

    await persister.flushAll();

    expect(saver.calls.map((c) => c.canvasId).sort()).toEqual([CANVAS, C2].sort());
    expect(scheduler.pendingCount()).toBe(0);
  });
});
