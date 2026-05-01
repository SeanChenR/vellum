/**
 * Sync room registry tests (task 2.3).
 *
 * Covers spec requirement:
 *   "Sync rooms are created lazily and released after idle"
 *
 * Tests inject:
 *   - a fake `createRoom` factory that returns lightweight stubs (avoids
 *     spinning up the real TLSocketRoom for unit tests)
 *   - synthetic timer hooks (`setTimer`/`clearTimer`) so 60-second idle waits
 *     are observable in milliseconds without sleeping
 *   - mock `loadSnapshot`/`saveSnapshot` that record call arguments
 *
 * Production wiring (task 3.3) replaces the factory with the real TLSocketRoom
 * and binds setTimer to globalThis.setTimeout.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { RoomSnapshot } from "@tldraw/sync-core";
import {
  RoomRegistry,
  type RoomRegistryOptions,
  type SyncRoomLike,
  type TimerHandle,
} from "./room";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

interface FakeRoom extends SyncRoomLike {
  readonly id: string;
  closed: boolean;
  snapshot: RoomSnapshot;
  dirty: boolean;
}

function makeFakeRoom(id: string, initial: RoomSnapshot | undefined): FakeRoom {
  const snapshot: RoomSnapshot = initial ?? { documents: [], schema: undefined as never };
  return {
    id,
    closed: false,
    snapshot,
    dirty: false,
    getCurrentSnapshot(): RoomSnapshot {
      return this.snapshot;
    },
    isClosed(): boolean {
      return this.closed;
    },
    close(): void {
      this.closed = true;
    },
  };
}

interface FakeTimer {
  fn: () => void;
  ms: number;
  cleared: boolean;
}

class FakeScheduler {
  timers = new Map<number, FakeTimer>();
  nextId = 1;

  setTimer = (fn: () => void, ms: number): TimerHandle => {
    const id = this.nextId++;
    this.timers.set(id, { fn, ms, cleared: false });
    return id as unknown as TimerHandle;
  };

  clearTimer = (handle: TimerHandle): void => {
    const t = this.timers.get(handle as number);
    if (t) t.cleared = true;
  };

  /** Fire the timer with the given handle synchronously. */
  fire(handle: TimerHandle): void {
    const t = this.timers.get(handle as number);
    if (!t) throw new Error(`no timer ${String(handle)}`);
    if (t.cleared) throw new Error(`timer ${String(handle)} was cleared`);
    t.fn();
  }

  /** Fire all uncleared timers in insertion order. */
  fireAll(): void {
    for (const [id, t] of this.timers) {
      if (!t.cleared) this.fire(id as unknown as TimerHandle);
    }
  }

  pendingCount(): number {
    let n = 0;
    for (const t of this.timers.values()) if (!t.cleared) n++;
    return n;
  }
}

interface CreatedRoomRecord {
  canvasId: string;
  initialSnapshot: RoomSnapshot | undefined;
  room: FakeRoom;
}

interface SnapshotIO {
  loadCalls: string[];
  saveCalls: Array<{ canvasId: string; snapshot: RoomSnapshot }>;
  loadSnapshot: (canvasId: string) => Promise<RoomSnapshot | undefined>;
  saveSnapshot: (canvasId: string, snapshot: RoomSnapshot) => Promise<void>;
}

function makeSnapshotIO(seed: Map<string, RoomSnapshot>): SnapshotIO {
  const loadCalls: string[] = [];
  const saveCalls: Array<{ canvasId: string; snapshot: RoomSnapshot }> = [];
  return {
    loadCalls,
    saveCalls,
    async loadSnapshot(canvasId) {
      loadCalls.push(canvasId);
      return seed.get(canvasId);
    },
    async saveSnapshot(canvasId, snapshot) {
      saveCalls.push({ canvasId, snapshot });
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const CANVAS_A = "00000000-0000-0000-0000-000000000001";
const CANVAS_B = "00000000-0000-0000-0000-000000000002";

let scheduler: FakeScheduler;
let io: SnapshotIO;
let createdRooms: CreatedRoomRecord[];
let registry: RoomRegistry<FakeRoom>;

function buildRegistry(opts?: { idleReleaseMs?: number }) {
  const options: RoomRegistryOptions<FakeRoom> = {
    createRoom(canvasId, initialSnapshot) {
      const room = makeFakeRoom(canvasId, initialSnapshot);
      createdRooms.push({ canvasId, initialSnapshot, room });
      return room;
    },
    loadSnapshot: io.loadSnapshot,
    saveSnapshot: io.saveSnapshot,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    idleReleaseMs: opts?.idleReleaseMs ?? 60_000,
  };
  registry = new RoomRegistry(options);
}

beforeEach(() => {
  scheduler = new FakeScheduler();
  io = makeSnapshotIO(new Map());
  createdRooms = [];
  buildRegistry();
});

// ---------------------------------------------------------------------------
// Lazy create + hydrate
// ---------------------------------------------------------------------------

describe("acquire — lazy create and hydrate", () => {
  test("first acquire(canvasId) creates a room and loads its snapshot from DB exactly once", async () => {
    const seed: RoomSnapshot = {
      documents: [{ state: { foo: 1 } as never, lastChangedClock: 0 }],
      schema: undefined as never,
    };
    io = makeSnapshotIO(new Map([[CANVAS_A, seed]]));
    buildRegistry();

    const r = await registry.acquire(CANVAS_A);
    expect(createdRooms).toHaveLength(1);
    expect(createdRooms[0]?.canvasId).toBe(CANVAS_A);
    expect(createdRooms[0]?.initialSnapshot).toBe(seed);
    expect(r).toBe(createdRooms[0]!.room);
    expect(io.loadCalls).toEqual([CANVAS_A]);
  });

  test("first acquire when DB has no snapshot creates a room with undefined initial state", async () => {
    await registry.acquire(CANVAS_A);
    expect(createdRooms).toHaveLength(1);
    expect(createdRooms[0]?.initialSnapshot).toBeUndefined();
  });

  test("second acquire(canvasId) reuses the existing room and does not reload from DB", async () => {
    const first = await registry.acquire(CANVAS_A);
    const second = await registry.acquire(CANVAS_A);

    expect(second).toBe(first);
    expect(createdRooms).toHaveLength(1);
    expect(io.loadCalls).toEqual([CANVAS_A]);
  });

  test("acquire is per-canvas — different canvas id triggers its own create + load", async () => {
    await registry.acquire(CANVAS_A);
    await registry.acquire(CANVAS_B);
    expect(createdRooms.map((r) => r.canvasId)).toEqual([CANVAS_A, CANVAS_B]);
    expect(io.loadCalls).toEqual([CANVAS_A, CANVAS_B]);
  });
});

// ---------------------------------------------------------------------------
// Connection counting
// ---------------------------------------------------------------------------

describe("connection counting", () => {
  test("acquire increments count, release decrements", async () => {
    expect(registry.getConnectionCount(CANVAS_A)).toBe(0);

    await registry.acquire(CANVAS_A);
    expect(registry.getConnectionCount(CANVAS_A)).toBe(1);

    await registry.acquire(CANVAS_A);
    expect(registry.getConnectionCount(CANVAS_A)).toBe(2);

    registry.release(CANVAS_A);
    expect(registry.getConnectionCount(CANVAS_A)).toBe(1);

    registry.release(CANVAS_A);
    expect(registry.getConnectionCount(CANVAS_A)).toBe(0);
  });

  test("connection counts are isolated per canvas", async () => {
    await registry.acquire(CANVAS_A);
    await registry.acquire(CANVAS_A);
    await registry.acquire(CANVAS_B);

    expect(registry.getConnectionCount(CANVAS_A)).toBe(2);
    expect(registry.getConnectionCount(CANVAS_B)).toBe(1);
  });

  test("release on a canvas with zero count MUST NOT make the count negative", async () => {
    registry.release(CANVAS_A);
    registry.release(CANVAS_A);
    expect(registry.getConnectionCount(CANVAS_A)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Idle timer
// ---------------------------------------------------------------------------

describe("idle release", () => {
  test("releasing the last connection schedules a single idle timer at idleReleaseMs", async () => {
    await registry.acquire(CANVAS_A);
    expect(scheduler.pendingCount()).toBe(0);

    registry.release(CANVAS_A);
    expect(scheduler.pendingCount()).toBe(1);
    const pendingTimer = Array.from(scheduler.timers.values()).find((t) => !t.cleared);
    expect(pendingTimer?.ms).toBe(60_000);
  });

  test("a non-zero connection count MUST NOT schedule an idle timer on release", async () => {
    await registry.acquire(CANVAS_A);
    await registry.acquire(CANVAS_A);
    registry.release(CANVAS_A);
    expect(scheduler.pendingCount()).toBe(0);
  });

  test("acquire during idle wait cancels the pending idle timer and reuses the same room", async () => {
    const first = await registry.acquire(CANVAS_A);
    registry.release(CANVAS_A);
    expect(scheduler.pendingCount()).toBe(1);

    const second = await registry.acquire(CANVAS_A);
    expect(second).toBe(first);
    expect(scheduler.pendingCount()).toBe(0);
    expect(createdRooms).toHaveLength(1);
    // Hydrate MUST NOT happen again.
    expect(io.loadCalls).toEqual([CANVAS_A]);
  });

  test("idle timer expiry flushes the room snapshot to the DB and disposes the room", async () => {
    const room = await registry.acquire(CANVAS_A);
    // simulate dirty state by mutating the fake room's snapshot
    room.snapshot = {
      documents: [{ state: { changed: true } as never, lastChangedClock: 1 }],
      schema: undefined as never,
    };

    registry.release(CANVAS_A);
    const handle = Array.from(scheduler.timers.keys())[0]!;
    scheduler.fire(handle as unknown as TimerHandle);
    // saveSnapshot is async — wait one microtask
    await new Promise((r) => setTimeout(r, 0));

    expect(io.saveCalls).toHaveLength(1);
    expect(io.saveCalls[0]?.canvasId).toBe(CANVAS_A);
    expect(io.saveCalls[0]?.snapshot).toBe(room.snapshot);
    expect(room.closed).toBe(true);
    expect(registry.getRoom(CANVAS_A)).toBeUndefined();
  });

  test("after idle dispose, the next acquire SHALL re-hydrate from DB into a fresh room", async () => {
    const room = await registry.acquire(CANVAS_A);
    registry.release(CANVAS_A);
    const handle = Array.from(scheduler.timers.keys())[0]!;
    scheduler.fire(handle as unknown as TimerHandle);
    await new Promise((r) => setTimeout(r, 0));

    const next = await registry.acquire(CANVAS_A);
    expect(next).not.toBe(room);
    expect(createdRooms).toHaveLength(2);
    expect(io.loadCalls).toEqual([CANVAS_A, CANVAS_A]);
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

describe("closeAll — graceful shutdown", () => {
  test("closeAll flushes every room's snapshot and disposes them", async () => {
    const a = await registry.acquire(CANVAS_A);
    const b = await registry.acquire(CANVAS_B);

    await registry.closeAll();

    expect(a.closed).toBe(true);
    expect(b.closed).toBe(true);
    expect(io.saveCalls.map((s) => s.canvasId).sort()).toEqual([CANVAS_A, CANVAS_B].sort());
    expect(registry.getRoom(CANVAS_A)).toBeUndefined();
    expect(registry.getRoom(CANVAS_B)).toBeUndefined();
  });

  test("closeAll cancels any pending idle timers", async () => {
    await registry.acquire(CANVAS_A);
    registry.release(CANVAS_A);
    expect(scheduler.pendingCount()).toBe(1);

    await registry.closeAll();
    expect(scheduler.pendingCount()).toBe(0);
  });
});
