/**
 * Persistence wiring tests — confirms the production sync server
 * actually invokes SnapshotPersister on mutations and on shutdown.
 *
 * Spec: multiplayer-sync —
 *   "Sync server flushes snapshots on every mutation via a debounced
 *    + cap window writer"
 *   "Graceful shutdown flushes the persister before disposing rooms"
 *
 * The wiring helpers under test:
 *   - `makeTrackingRoomFactory(persister, schema, createRoom)`:
 *      returns a (canvasId, initialSnapshot) → room factory whose
 *      rooms have an `onDataChange` callback that calls
 *      `persister.notifyDirty(canvasId, () => room.getCurrentSnapshot())`.
 *   - `flushThenShutdown(persister, syncShutdown, log)`:
 *      awaits `persister.flushAll()` BEFORE awaiting `syncShutdown()`,
 *      and continues to `syncShutdown()` even if `flushAll` rejects.
 */

import { describe, expect, mock, test } from "bun:test";
import { flushThenShutdown, makeTrackingRoomFactory } from "./wiring";

// We don't care about the snapshot's full structure here — the wiring
// helpers treat it as opaque. Cast through unknown to skip the strict
// RecordId branding required by the real RoomSnapshot type.
type MockSnapshot = { documentClock: number };
import type { RoomSnapshot } from "@tldraw/sync-core";

function mkSnapshot(documentClock: number): RoomSnapshot {
  return { documentClock } as unknown as RoomSnapshot;
}

function makeStubPersister() {
  return {
    notifyDirty: mock((_canvasId: string, _getSnapshot: () => RoomSnapshot) => undefined),
    flushAll: mock(async () => undefined),
  };
}

interface StubRoom {
  onDataChange?: () => void;
  getCurrentSnapshot: () => RoomSnapshot;
  isClosed: () => boolean;
  close: () => void;
}

function makeStubRoom(): StubRoom {
  let closed = false;
  return {
    getCurrentSnapshot: () => mkSnapshot(42),
    isClosed: () => closed,
    close: () => {
      closed = true;
    },
  };
}

describe("makeTrackingRoomFactory — onDataChange wiring", () => {
  test("createRoom returns a room whose onDataChange callback fires persister.notifyDirty with canvasId + a snapshot getter", () => {
    const persister = makeStubPersister();
    const stubRoom = makeStubRoom();

    const createRoom = mock((opts: { initialSnapshot: unknown; onDataChange?: () => void }) => {
      stubRoom.onDataChange = opts.onDataChange;
      return stubRoom;
    });

    const factory = makeTrackingRoomFactory(
      persister as unknown as Parameters<typeof makeTrackingRoomFactory>[0],
      { schema: "fake-schema" } as Parameters<typeof makeTrackingRoomFactory>[1],
      createRoom as unknown as Parameters<typeof makeTrackingRoomFactory>[2],
    );

    const room = factory("canvas-1", { documents: [] } as unknown as RoomSnapshot);
    expect(room).toBe(stubRoom as unknown as typeof room);
    expect(createRoom).toHaveBeenCalledTimes(1);

    // Simulate tldraw firing a data-change event
    expect(stubRoom.onDataChange).toBeDefined();
    stubRoom.onDataChange!();

    expect(persister.notifyDirty).toHaveBeenCalledTimes(1);
    const args = persister.notifyDirty.mock.calls[0]!;
    expect(args[0]).toBe("canvas-1");
    // The second arg is a () => snapshot closure — invoking it must reach
    // back into the room.
    const getSnapshot = args[1];
    expect(getSnapshot()).toEqual(mkSnapshot(42));
  });

  test("multiple rooms keep their canvasId / snapshot bindings independent", () => {
    const persister = makeStubPersister();
    const roomA = makeStubRoom();
    const roomB = makeStubRoom();
    Object.defineProperty(roomA, "getCurrentSnapshot", { value: () => mkSnapshot(1) });
    Object.defineProperty(roomB, "getCurrentSnapshot", { value: () => mkSnapshot(2) });

    let nthCall = 0;
    const createRoom = (opts: { onDataChange?: () => void }) => {
      const r = nthCall++ === 0 ? roomA : roomB;
      r.onDataChange = opts.onDataChange;
      return r;
    };

    const factory = makeTrackingRoomFactory(
      persister as unknown as Parameters<typeof makeTrackingRoomFactory>[0],
      { schema: "fake" } as Parameters<typeof makeTrackingRoomFactory>[1],
      createRoom as unknown as Parameters<typeof makeTrackingRoomFactory>[2],
    );

    factory("canvas-A", {} as unknown as RoomSnapshot);
    factory("canvas-B", {} as unknown as RoomSnapshot);

    roomA.onDataChange!();
    roomB.onDataChange!();

    expect(persister.notifyDirty).toHaveBeenCalledTimes(2);
    const [callA, callB] = persister.notifyDirty.mock.calls;
    expect(callA![0]).toBe("canvas-A");
    expect(callA![1]()).toEqual(mkSnapshot(1));
    expect(callB![0]).toBe("canvas-B");
    expect(callB![1]()).toEqual(mkSnapshot(2));
  });
});

describe("flushThenShutdown — ordering + error tolerance", () => {
  test("awaits persister.flushAll BEFORE awaiting syncShutdown", async () => {
    const order: string[] = [];
    const persister = {
      flushAll: mock(async () => {
        order.push("flushAll-start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("flushAll-end");
      }),
    };
    const syncShutdown = mock(async () => {
      order.push("shutdown-start");
      await new Promise((r) => setTimeout(r, 5));
      order.push("shutdown-end");
    });
    const log = { error: mock(() => undefined) };

    await flushThenShutdown(persister, syncShutdown, log);

    expect(order).toEqual(["flushAll-start", "flushAll-end", "shutdown-start", "shutdown-end"]);
    expect(log.error).not.toHaveBeenCalled();
  });

  test("flushAll rejection logs and STILL invokes syncShutdown", async () => {
    const persister = {
      flushAll: mock(async () => {
        throw new Error("DB outage");
      }),
    };
    const syncShutdown = mock(async () => undefined);
    const log = { error: mock(() => undefined) };

    await flushThenShutdown(persister, syncShutdown, log);

    expect(syncShutdown).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
    const firstCall = log.error.mock.calls[0] as unknown as [{ err: unknown }, string] | undefined;
    const errArg = firstCall?.[0];
    expect(String(errArg?.err)).toContain("DB outage");
  });

  test("syncShutdown rejection propagates AFTER flushAll succeeds", async () => {
    const persister = { flushAll: mock(async () => undefined) };
    const syncShutdown = mock(async () => {
      throw new Error("close-all failure");
    });
    const log = { error: mock(() => undefined) };

    // syncShutdown failure is the caller's problem — flushThenShutdown
    // shouldn't swallow it (the outer `shutdownGracefully` already wraps
    // syncServer.shutdown in try/catch).
    await expect(flushThenShutdown(persister, syncShutdown, log)).rejects.toThrow(
      "close-all failure",
    );
    expect(persister.flushAll).toHaveBeenCalledTimes(1);
  });
});
