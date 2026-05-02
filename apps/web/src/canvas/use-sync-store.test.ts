/**
 * Sync store hook tests (task 4.1).
 *
 * Covers spec requirement:
 *   "Client reconnects with exponential backoff and stops on permanent failures"
 *
 * The reconnection logic is factored out of the React hook into a plain
 * `SyncReconnectController` class so it can be tested with a fake clock and
 * a deterministic random source — no DOM, no WebSocket, no React rendering.
 *
 * The Zustand connection store (`useSyncConnectionStore`) is exercised
 * separately via direct subscriptions; the hook itself wires the controller
 * to a real WebSocket and gets manually verified in task 6.4.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  PERMANENT_CLOSE_CODES,
  RECONNECT_BACKOFF_MS,
  SyncReconnectController,
  useSyncConnectionStore,
  type ConnectionState,
} from "./use-sync-store";

// ---------------------------------------------------------------------------
// Fake clock + scheduler — same shape as backend persistence/room tests
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

  setTimer = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.timers.set(id, { fn, fireAt: this.now + ms, cleared: false });
    return id;
  };

  clearTimer = (handle: unknown): void => {
    const t = this.timers.get(handle as number);
    if (t) t.cleared = true;
  };

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let due: { id: number; t: FakeTimer } | null = null;
      for (const [id, t] of this.timers) {
        if (t.cleared || t.fireAt > target) continue;
        if (!due || t.fireAt < due.t.fireAt) due = { id, t };
      }
      if (!due) break;
      this.now = due.t.fireAt;
      this.timers.delete(due.id);
      due.t.fn();
    }
    this.now = target;
  }

  pendingDelay(): number | null {
    for (const t of this.timers.values()) {
      if (!t.cleared) return t.fireAt - this.now;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fake reconnect target — records every reconnect attempt
// ---------------------------------------------------------------------------

interface ReconnectSpy {
  calls: number;
  reconnect: () => void;
}

function spy(): ReconnectSpy {
  const s: ReconnectSpy = {
    calls: 0,
    reconnect() {
      s.calls++;
    },
  };
  return s;
}

let scheduler: FakeScheduler;
let attempts: ReconnectSpy;

function buildController(opts?: { random?: () => number }): SyncReconnectController {
  return new SyncReconnectController({
    reconnect: attempts.reconnect,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    random: opts?.random ?? (() => 0.5),
  });
}

beforeEach(() => {
  scheduler = new FakeScheduler();
  attempts = spy();
  useSyncConnectionStore.setState({ state: "connecting", attempt: 0 });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("reconnect constants align with design", () => {
  test("five backoff steps at 1s, 2s, 4s, 8s, 16s", () => {
    expect(RECONNECT_BACKOFF_MS).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
  });

  test("permanent close codes are 4401, 4403, 4404, 4429", () => {
    expect([...PERMANENT_CLOSE_CODES].sort()).toEqual([4401, 4403, 4404, 4429]);
  });
});

// ---------------------------------------------------------------------------
// Transient close → exponential backoff with jitter
// ---------------------------------------------------------------------------

describe("transient close — exponential backoff with jitter", () => {
  test("first transient close schedules a reconnect at 1s base delay (random=0.5 → no jitter)", () => {
    const c = buildController({ random: () => 0.5 });
    const next = c.handleClose(1006);
    expect(next).toBe<ConnectionState>("reconnecting");
    expect(scheduler.pendingDelay()).toBe(RECONNECT_BACKOFF_MS[0]!);
  });

  test("each successive failure escalates through 1s, 2s, 4s, 8s, 16s", () => {
    const c = buildController({ random: () => 0.5 });
    for (let i = 0; i < RECONNECT_BACKOFF_MS.length; i++) {
      c.handleClose(1006);
      expect(scheduler.pendingDelay()).toBe(RECONNECT_BACKOFF_MS[i]!);
      // Fire the timer → invokes reconnect → simulate the next close.
      scheduler.advance(RECONNECT_BACKOFF_MS[i]!);
    }
    expect(attempts.calls).toBe(RECONNECT_BACKOFF_MS.length);
  });

  test("jitter applies a uniform -20% offset when random=0", () => {
    const c = buildController({ random: () => 0 });
    c.handleClose(1006);
    expect(scheduler.pendingDelay()).toBe(Math.round(RECONNECT_BACKOFF_MS[0]! * 0.8));
  });

  test("jitter applies a uniform +20% offset when random=1", () => {
    const c = buildController({ random: () => 1 });
    c.handleClose(1006);
    expect(scheduler.pendingDelay()).toBe(Math.round(RECONNECT_BACKOFF_MS[0]! * 1.2));
  });

  test("after 5 failed reconnects the 6th close transitions to disconnected and stops scheduling", () => {
    const c = buildController({ random: () => 0.5 });
    for (let i = 0; i < RECONNECT_BACKOFF_MS.length; i++) {
      c.handleClose(1006);
      scheduler.advance(RECONNECT_BACKOFF_MS[i]!);
    }
    // 6th close — already exhausted.
    const final = c.handleClose(1006);
    expect(final).toBe<ConnectionState>("disconnected");
    expect(scheduler.pendingDelay()).toBeNull();
  });

  test("a successful open resets the attempt counter — next close starts at 1s again", () => {
    const c = buildController({ random: () => 0.5 });
    c.handleClose(1006);
    scheduler.advance(RECONNECT_BACKOFF_MS[0]!);
    c.handleClose(1006);
    expect(scheduler.pendingDelay()).toBe(RECONNECT_BACKOFF_MS[1]!); // 2s

    // Connection succeeds — reset.
    c.handleOpen();
    expect(scheduler.pendingDelay()).toBeNull();
    c.handleClose(1006);
    expect(scheduler.pendingDelay()).toBe(RECONNECT_BACKOFF_MS[0]!); // 1s again
  });
});

// ---------------------------------------------------------------------------
// Permanent close codes — never retry
// ---------------------------------------------------------------------------

describe("permanent close codes never schedule a reconnect", () => {
  for (const code of PERMANENT_CLOSE_CODES) {
    test(`close code ${code} transitions directly to disconnected with no pending timer`, () => {
      const c = buildController();
      const next = c.handleClose(code);
      expect(next).toBe<ConnectionState>("disconnected");
      expect(scheduler.pendingDelay()).toBeNull();
    });
  }

  test("a permanent close mid-backoff cancels the pending timer", () => {
    const c = buildController();
    c.handleClose(1006);
    expect(scheduler.pendingDelay()).not.toBeNull();
    c.handleClose(4403);
    expect(scheduler.pendingDelay()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

describe("cancel — clears any pending reconnect", () => {
  test("cancel removes a scheduled timer", () => {
    const c = buildController();
    c.handleClose(1006);
    expect(scheduler.pendingDelay()).not.toBeNull();
    c.cancel();
    expect(scheduler.pendingDelay()).toBeNull();
  });

  test("cancel on an idle controller is a no-op", () => {
    const c = buildController();
    c.cancel();
    c.cancel();
    expect(scheduler.pendingDelay()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Zustand connection store
// ---------------------------------------------------------------------------

describe("useSyncConnectionStore — Zustand connection store", () => {
  test("default state is connecting with attempt 0", () => {
    expect(useSyncConnectionStore.getState().state).toBe<ConnectionState>("connecting");
    expect(useSyncConnectionStore.getState().attempt).toBe(0);
  });

  test("subscribers SHALL be notified on state change", () => {
    const seen: ConnectionState[] = [];
    const unsubscribe = useSyncConnectionStore.subscribe((s) => {
      seen.push(s.state);
    });
    useSyncConnectionStore.setState({ state: "connected" });
    useSyncConnectionStore.setState({ state: "reconnecting" });
    useSyncConnectionStore.setState({ state: "disconnected" });
    unsubscribe();
    expect(seen).toEqual(["connected", "reconnecting", "disconnected"]);
  });
});

// ---------------------------------------------------------------------------
// add-sharing extension (task 4.4): public-link token plumbing + role
// ---------------------------------------------------------------------------

describe("buildSyncUri — public-link token plumbing", () => {
  test("builds a same-origin URI without token", async () => {
    const { buildSyncUri } = await import("./use-sync-store");
    const uri = buildSyncUri({
      protocol: "http:",
      host: "example.com",
      port: "",
      hostname: "example.com",
      canvasId: "c1",
    });
    expect(uri).toBe("ws://example.com/sync/c1");
  });

  test("appends ?token=... when shareToken is given", async () => {
    const { buildSyncUri } = await import("./use-sync-store");
    const uri = buildSyncUri({
      protocol: "https:",
      host: "vellum.app",
      port: "",
      hostname: "vellum.app",
      canvasId: "c1",
      shareToken: "abc123",
    });
    expect(uri).toBe("wss://vellum.app/sync/c1?token=abc123");
  });

  test("dev mode at :3002 routes WS straight to :3000", async () => {
    const { buildSyncUri } = await import("./use-sync-store");
    const uri = buildSyncUri({
      protocol: "http:",
      host: "localhost:3002",
      port: "3002",
      hostname: "localhost",
      canvasId: "c1",
    });
    expect(uri).toBe("ws://localhost:3000/sync/c1");
  });
});
