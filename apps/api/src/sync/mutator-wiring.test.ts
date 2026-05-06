/**
 * mutator-wiring.test.ts — verify the sync server exposes its room
 * registry so the Server tldraw Mutator (M12.1) shares the same active-
 * room map.
 *
 * Spec ref: openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 */

import { describe, expect, mock, test } from "bun:test";
import { applyMutation } from "./mutator";
import { RoomRegistry, type SyncRoomLike } from "./room";
import { createSyncServer, type SyncServerDeps } from "./index";
import { createConcurrentConnectionRegistry } from "./rate-limit";
import { RateLimiter } from "../lib/rate-limiter";

function makeRegistry(): RoomRegistry<SyncRoomLike> {
  return new RoomRegistry<SyncRoomLike>({
    createRoom: () =>
      ({
        getCurrentSnapshot: () => ({ documents: [], schema: undefined as never }),
        isClosed: () => false,
        close: () => {},
      }) as SyncRoomLike,
    loadSnapshot: async () => undefined,
    saveSnapshot: async () => {},
    setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimer: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
    idleReleaseMs: 60_000,
  });
}

function makeSyncDeps(registry: RoomRegistry<SyncRoomLike>): SyncServerDeps {
  return {
    registry,
    rateLimiter: new RateLimiter(),
    connectionRegistry: createConcurrentConnectionRegistry(),
    auth: {
      resolveSession: mock(async () => null),
      resolveCanvasRole: mock(async () => ({ canvasExists: false, role: null })),
      resolveCanvasShareLink: mock(async () => null),
    },
    resolveClientIp: () => "127.0.0.1",
  };
}

// ---------------------------------------------------------------------------
// 6.1 getRoomRegistry returns the same instance passed in deps
// ---------------------------------------------------------------------------

describe("createSyncServer().getRoomRegistry()", () => {
  test("returns the exact same RoomRegistry instance supplied via deps", () => {
    const registry = makeRegistry();
    const server = createSyncServer(makeSyncDeps(registry));

    expect(server.getRoomRegistry()).toBe(registry);
  });
});

// ---------------------------------------------------------------------------
// 6.2 mutator without an active room — canvasNotInActiveRoom for any id
// ---------------------------------------------------------------------------

describe("applyMutation against an unwired / empty registry", () => {
  test("any canvasId resolves to canvasNotInActiveRoom when no client is connected", async () => {
    const registry = makeRegistry();
    const server = createSyncServer(makeSyncDeps(registry));

    const result = await applyMutation({ registry: server.getRoomRegistry() }, "any-canvas-id", [
      {
        type: "createShape",
        payload: { id: "shape:abc", type: "geo", x: 0, y: 0, props: {} },
      },
    ]);

    expect(result).toEqual({
      ok: false,
      errorKey: "errors.devMutate.canvasNotInActiveRoom",
    });
  });
});
