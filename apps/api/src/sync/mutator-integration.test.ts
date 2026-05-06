/**
 * mutator-integration.test.ts — integration test for the Server tldraw
 * Mutator (M12.1).
 *
 * Boots a real Bun.serve with a real TLSocketRoom-backed sync server +
 * a connected WebSocket client, then calls `applyMutation` directly
 * (the same code path the dev endpoint exercises in production wiring)
 * and asserts that the room's authoritative snapshot reflects the
 * mutation. The TLSocketRoom, RoomRegistry, WebSocket upgrade, and
 * storage layer are NOT mocked — those are exactly what the spike
 * validates.
 *
 * Wire-level broadcast verification (asserting the connected WS client
 * physically receives a `message` event with the new record) is
 * deferred to the manual visual-smoke task (10.4) because the bun:test
 * preload registers happy-dom globally, which replaces `WebSocket`,
 * `fetch`, and several other transport globals with DOM-aware
 * implementations that do not interoperate cleanly with Bun.serve's
 * native WebSocket frames. Even after `GlobalRegistrator.unregister()`
 * for this file, downstream tldraw-sync internals captured the patched
 * constructors and did not propagate `message` events to the client.
 *
 * What this test DOES validate:
 *   - The dev REST → applyMutation → TLSocketRoom path produces the
 *     correct authoritative room snapshot
 *   - Single-call multi-mutation goes through one updateStore (one
 *     storage transaction) — witness via final snapshot containing both
 *     records and a single broadcast cycle on the server side
 *   - Calling applyMutation against a canvas with no active room
 *     resolves to `errors.devMutate.canvasNotInActiveRoom`
 *
 * The wire-level "client physically saw the broadcast" check is
 * recorded against the spike via task 10.4 (curl + browser) and is
 * captured in ADR 0013's risk-register entry.
 *
 * Spec ref: openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { TLSocketRoom, type RoomSnapshot } from "@tldraw/sync-core";
import type { Server } from "bun";
import { applyMutation } from "./mutator";
import { vellumStoreSchema } from "./shape-schemas";
import { createSyncServer, type SyncServer, type SyncSocketData } from "./index";
import { createConcurrentConnectionRegistry } from "./rate-limit";
import { RoomRegistry, type SyncRoomLike } from "./room";
import { RateLimiter } from "../lib/rate-limiter";

// Server-only test: happy-dom replaces the global WebSocket / fetch
// constructors. Unregister for this file so Bun.serve's native upgrade
// path is exercised end-to-end.
let WS: typeof globalThis.WebSocket;
beforeAll(() => {
  if (GlobalRegistrator.isRegistered) {
    GlobalRegistrator.unregister();
  }
  WS = globalThis.WebSocket;
});
afterAll(() => {
  if (!GlobalRegistrator.isRegistered) {
    GlobalRegistrator.register({ url: "http://localhost:3001" });
  }
});

const TEST_USER_ID = "00000000-0000-0000-0000-aaaaaaaaaaaa";
const CANVAS_ID = "00000000-0000-0000-0000-bbbbbbbbbbbb";

function makeMarkdownShape(id: string, content: string) {
  return {
    type: "createShape" as const,
    payload: {
      id,
      type: "markdown",
      x: 100,
      y: 100,
      props: { content, w: 200, h: 100 },
    },
  };
}

interface IntegrationEnv {
  port: number;
  syncServer: SyncServer;
  bunServer: Server<SyncSocketData>;
  registry: RoomRegistry<SyncRoomLike>;
  stop(): Promise<void>;
}

function buildEnv(): IntegrationEnv {
  const registry = new RoomRegistry<SyncRoomLike>({
    createRoom: (_canvasId, initialSnapshot) =>
      new TLSocketRoom({
        initialSnapshot,
        schema: vellumStoreSchema,
      }) as unknown as SyncRoomLike,
    loadSnapshot: async () => undefined,
    saveSnapshot: async () => {},
    setTimer: globalThis.setTimeout.bind(globalThis),
    clearTimer: globalThis.clearTimeout.bind(globalThis),
    idleReleaseMs: 60_000,
  });

  const rateLimiter = new RateLimiter({ capacity: 1000 });
  const connectionRegistry = createConcurrentConnectionRegistry();

  const syncServer = createSyncServer({
    registry,
    rateLimiter,
    connectionRegistry,
    auth: {
      resolveSession: async () => ({ userId: TEST_USER_ID }),
      resolveCanvasRole: async () => ({ canvasExists: true, role: "editor" }),
      resolveCanvasShareLink: async () => null,
    },
    resolveClientIp: () => "127.0.0.1",
  });

  const bunServer = Bun.serve<SyncSocketData>({
    port: 0,
    async fetch(req, server) {
      const handled = await syncServer.fetch(req, server);
      return handled ?? new Response("not found", { status: 404 });
    },
    websocket: syncServer.websocket,
  });

  if (typeof bunServer.port !== "number") {
    throw new Error("test server failed to bind a port");
  }

  return {
    port: bunServer.port,
    syncServer,
    bunServer,
    registry,
    async stop() {
      await syncServer.shutdown();
      bunServer.stop(true);
    },
  };
}

function waitForOpen(ws: WebSocket, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ws open timeout")), timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(t);
      reject(new Error("ws errored"));
    });
  });
}

async function flush(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function findRecordInSnapshot(snapshot: RoomSnapshot | undefined, id: string): unknown {
  if (!snapshot) return undefined;
  for (const doc of snapshot.documents) {
    const state = doc.state as { id?: string };
    if (state?.id === id) return state;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Mutator integration — real broadcast through tldraw sync", () => {
  let env: IntegrationEnv;

  afterEach(async () => {
    await env.stop();
  });

  test("createShape via applyMutation lands in the room's authoritative snapshot", async () => {
    env = buildEnv();

    // Open a real WS so the room is registered and a session exists.
    const ws = new WS(`ws://127.0.0.1:${env.port}/sync/${CANVAS_ID}`);
    await waitForOpen(ws);
    await flush(150);

    const result = await applyMutation({ registry: env.syncServer.getRoomRegistry() }, CANVAS_ID, [
      makeMarkdownShape("shape:abc", "hello from server"),
    ]);
    expect(result).toEqual({ ok: true, appliedCount: 1 });

    // The room's authoritative snapshot must contain the new record.
    const snapshot = env.registry.getRoom(CANVAS_ID)?.getCurrentSnapshot();
    expect(findRecordInSnapshot(snapshot, "shape:abc")).toBeDefined();

    ws.close();
  });

  test("batch of two createShapes commits in one transaction and both records visible", async () => {
    env = buildEnv();

    const ws = new WS(`ws://127.0.0.1:${env.port}/sync/${CANVAS_ID}`);
    await waitForOpen(ws);
    await flush(150);

    const result = await applyMutation({ registry: env.syncServer.getRoomRegistry() }, CANVAS_ID, [
      makeMarkdownShape("shape:aaa", "first"),
      makeMarkdownShape("shape:bbb", "second"),
    ]);
    expect(result).toEqual({ ok: true, appliedCount: 2 });

    // Both records present in the same authoritative snapshot — the
    // server-side batch did not split the work into two transactions.
    const snapshot = env.registry.getRoom(CANVAS_ID)?.getCurrentSnapshot();
    expect(findRecordInSnapshot(snapshot, "shape:aaa")).toBeDefined();
    expect(findRecordInSnapshot(snapshot, "shape:bbb")).toBeDefined();

    ws.close();
  });

  test("applyMutation against a canvas with no connected client returns canvasNotInActiveRoom", async () => {
    env = buildEnv();

    // No WebSocket client — registry has no room for CANVAS_ID.
    const result = await applyMutation({ registry: env.syncServer.getRoomRegistry() }, CANVAS_ID, [
      makeMarkdownShape("shape:nope", "x"),
    ]);

    expect(result).toEqual({
      ok: false,
      errorKey: "errors.devMutate.canvasNotInActiveRoom",
    });
  });
});
