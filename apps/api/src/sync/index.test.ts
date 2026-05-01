/**
 * Sync server integration tests (task 2.5).
 *
 * Replaces the spike scaffold (`spike.test.ts`). Covers spec requirements:
 *   - "Server hydrates rooms from DB and resists overwrites by HTTP"
 *   - "Sync server uses defined close codes for protocol-level failures"
 *
 * The sync server exposes `createSyncServer(deps)` returning `{ fetch,
 * websocket, shutdown, isCanvasInActiveRoom }`. Tests inject mocks for
 * auth/permission lookups, the snapshot DB layer, and the IP resolver.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { RoomSnapshot } from "@tldraw/sync-core";
import type { Server } from "bun";
import { RateLimiter } from "../lib/rate-limiter";
import {
  createSyncServer,
  type SyncServer,
  type SyncServerDeps,
  type SyncSocketData,
} from "./index";
import { createConcurrentConnectionRegistry } from "./rate-limit";
import { RoomRegistry } from "./room";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CANVAS_OWNER = "00000000-0000-0000-0000-aaaaaaaaaaaa";
const CANVAS_FORBIDDEN = "00000000-0000-0000-0000-bbbbbbbbbbbb";
const CANVAS_MISSING = "00000000-0000-0000-0000-cccccccccccc";

interface CanvasFixture {
  exists: boolean;
  ownerId?: string;
  initialSnapshot?: RoomSnapshot;
}

interface TestEnv {
  port: number;
  baseUrl: string;
  syncServer: SyncServer;
  bunServer: Server<SyncSocketData>;
  registry: RoomRegistry;
  saveCalls: Array<{ canvasId: string; snapshot: RoomSnapshot }>;
  loadCalls: string[];
  stop(): Promise<void>;
}

function buildEnv(
  canvases: Record<string, CanvasFixture>,
  options?: {
    resolveUserId?: (req: Request) => Promise<string | null>;
  },
): TestEnv {
  const saveCalls: Array<{ canvasId: string; snapshot: RoomSnapshot }> = [];
  const loadCalls: string[] = [];

  const registry = new RoomRegistry({
    createRoom(_canvasId, initialSnapshot) {
      return {
        getCurrentSnapshot(): RoomSnapshot {
          return (
            initialSnapshot ?? {
              documents: [],
              schema: undefined as never,
            }
          );
        },
        isClosed: () => false,
        close() {},
      };
    },
    async loadSnapshot(canvasId) {
      loadCalls.push(canvasId);
      return canvases[canvasId]?.initialSnapshot;
    },
    async saveSnapshot(canvasId, snapshot) {
      saveCalls.push({ canvasId, snapshot });
    },
    setTimer: globalThis.setTimeout.bind(globalThis),
    clearTimer: globalThis.clearTimeout.bind(globalThis),
    idleReleaseMs: 60_000,
  });

  const rateLimiter = new RateLimiter({ capacity: 1000 });
  const connectionRegistry = createConcurrentConnectionRegistry();

  const deps: SyncServerDeps = {
    registry,
    rateLimiter,
    connectionRegistry,
    auth: {
      async resolveSession(req) {
        if (options?.resolveUserId) {
          const id = await options.resolveUserId(req);
          return id ? { userId: id } : null;
        }
        return { userId: CANVAS_OWNER }; // default: authenticated as the canvas owner
      },
      async resolveCanvasRole(userId, canvasId) {
        const c = canvases[canvasId];
        if (!c?.exists) return { canvasExists: false, role: null };
        if (c.ownerId === userId) return { canvasExists: true, role: "editor" };
        return { canvasExists: true, role: null };
      },
    },
    resolveClientIp(_req) {
      return "127.0.0.1";
    },
  };

  const syncServer = createSyncServer(deps);
  const bunServer = Bun.serve({
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
    baseUrl: `http://127.0.0.1:${bunServer.port}`,
    syncServer,
    bunServer,
    registry,
    saveCalls,
    loadCalls,
    async stop() {
      await syncServer.shutdown();
      bunServer.stop(true);
    },
  };
}

function wsUrl(env: TestEnv, canvasId: string): string {
  return `ws://127.0.0.1:${env.port}/sync/${canvasId}`;
}

function waitForOpen(ws: WebSocket, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws open timeout")), timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("ws errored"));
    });
  });
}

function waitForClose(ws: WebSocket, timeoutMs = 1000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve({ code: 1006, reason: "" });
      return;
    }
    const timer = setTimeout(() => reject(new Error("ws close timeout")), timeoutMs);
    ws.addEventListener("close", (ev) => {
      clearTimeout(timer);
      resolve({ code: (ev as CloseEvent).code, reason: (ev as CloseEvent).reason });
    });
  });
}

async function flush(ms = 50): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Cold-start hydration
// ---------------------------------------------------------------------------

describe("server hydrates rooms from DB on first connect", () => {
  let env: TestEnv;

  afterEach(async () => {
    await env.stop();
  });

  test("the first WS connection for a canvas SHALL trigger exactly one snapshot load", async () => {
    const seed: RoomSnapshot = {
      documents: [{ state: { kind: "shape" } as never, lastChangedClock: 1 }],
      schema: undefined as never,
    };
    env = buildEnv({
      [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER, initialSnapshot: seed },
    });

    const ws = new WebSocket(wsUrl(env, CANVAS_OWNER));
    await waitForOpen(ws);
    await flush();

    expect(env.loadCalls).toEqual([CANVAS_OWNER]);
    expect(env.registry.getRoom(CANVAS_OWNER)?.getCurrentSnapshot()).toEqual(seed);

    ws.close();
    await waitForClose(ws);
  });

  test("a second concurrent connection MUST NOT re-load the snapshot from DB", async () => {
    env = buildEnv({
      [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER },
    });

    const a = new WebSocket(wsUrl(env, CANVAS_OWNER));
    await waitForOpen(a);
    await flush();
    const b = new WebSocket(wsUrl(env, CANVAS_OWNER));
    await waitForOpen(b);
    await flush();

    expect(env.loadCalls).toEqual([CANVAS_OWNER]);
    a.close();
    b.close();
    await Promise.all([waitForClose(a), waitForClose(b)]);
  });
});

// ---------------------------------------------------------------------------
// Handshake refusal codes (HTTP statuses, not yet upgraded)
// ---------------------------------------------------------------------------

describe("handshake refusal status codes", () => {
  let env: TestEnv;

  afterEach(async () => {
    await env.stop();
  });

  // happy-dom's fetch implementation chokes on responses to upgrade-style
  // requests, so these tests invoke `syncServer.fetch(req, server)` directly
  // — the same entry point Bun.serve calls. Bypasses the HTTP client entirely.
  async function probeReject(canvasId: string): Promise<Response> {
    const req = new Request(`${env.baseUrl}/sync/${canvasId}`, { method: "GET" });
    const res = await env.syncServer.fetch(req, env.bunServer);
    if (!res) throw new Error("expected a refusal response, got upgrade");
    return res;
  }

  test("missing/invalid session SHALL refuse upgrade with HTTP 401", async () => {
    env = buildEnv(
      { [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER } },
      { resolveUserId: async () => null },
    );

    const res = await probeReject(CANVAS_OWNER);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("errors.auth.unauthorized");
  });

  test("authenticated user without canvas role SHALL refuse upgrade with HTTP 403", async () => {
    env = buildEnv({
      [CANVAS_FORBIDDEN]: { exists: true, ownerId: "someone-else" },
    });

    const res = await probeReject(CANVAS_FORBIDDEN);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.forbidden");
  });

  test("non-existent canvas SHALL refuse upgrade with HTTP 404", async () => {
    env = buildEnv({});

    const res = await probeReject(CANVAS_MISSING);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.notFound");
  });
});

// ---------------------------------------------------------------------------
// HTTP PATCH coupling — active room rejection
// ---------------------------------------------------------------------------

describe("isCanvasInActiveRoom predicate (consumed by PATCH /api/canvas/:id)", () => {
  let env: TestEnv;

  afterEach(async () => {
    await env.stop();
  });

  test("returns false when no room exists for the canvas", () => {
    env = buildEnv({
      [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER },
    });
    expect(env.syncServer.isCanvasInActiveRoom(CANVAS_OWNER)).toBe(false);
  });

  test("returns true while a connection is open against the canvas", async () => {
    env = buildEnv({
      [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER },
    });
    const ws = new WebSocket(wsUrl(env, CANVAS_OWNER));
    await waitForOpen(ws);
    await flush();

    expect(env.syncServer.isCanvasInActiveRoom(CANVAS_OWNER)).toBe(true);

    ws.close();
    await waitForClose(ws);
  });
});

// ---------------------------------------------------------------------------
// Close codes
// ---------------------------------------------------------------------------

describe("close codes", () => {
  let env: TestEnv;

  afterEach(async () => {
    await env.stop();
  });

  test("canvas deletion broadcasts close code 4404 to every connected peer", async () => {
    env = buildEnv({
      [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER },
    });

    const a = new WebSocket(wsUrl(env, CANVAS_OWNER));
    const b = new WebSocket(wsUrl(env, CANVAS_OWNER));
    await Promise.all([waitForOpen(a), waitForOpen(b)]);
    await flush();

    // Simulate canvas deletion by signalling the sync server.
    env.syncServer.notifyCanvasDeleted(CANVAS_OWNER);

    const [closeA, closeB] = await Promise.all([waitForClose(a), waitForClose(b)]);
    expect(closeA.code).toBe(4404);
    expect(closeB.code).toBe(4404);
    expect(env.registry.getRoom(CANVAS_OWNER)).toBeUndefined();
  });

  test("graceful shutdown closes every open WebSocket with code 1001 and flushes pending state", async () => {
    env = buildEnv({
      [CANVAS_OWNER]: { exists: true, ownerId: CANVAS_OWNER },
    });

    const ws = new WebSocket(wsUrl(env, CANVAS_OWNER));
    await waitForOpen(ws);
    await flush();

    const closePromise = waitForClose(ws);
    await env.syncServer.shutdown();
    const close = await closePromise;
    expect(close.code).toBe(4001);
    // saveCalls SHALL include the canvas — final flush executed.
    expect(env.saveCalls.some((c) => c.canvasId === CANVAS_OWNER)).toBe(true);
  });
});
