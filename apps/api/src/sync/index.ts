/**
 * Sync server — Bun.serve WebSocket integration that wires together auth,
 * rate-limit, room registry, and the close-code protocol.
 *
 * Public surface:
 *   - `createSyncServer(deps)` returns `{ fetch, websocket, shutdown,
 *     isCanvasInActiveRoom, notifyCanvasDeleted }`
 *   - `fetch(req, server)` matches `/sync/:canvasId` and runs the handshake
 *     before delegating to `server.upgrade`
 *   - `websocket` is a Bun `WebSocketHandler` covering `open` / `message` /
 *     `close`
 *
 * Close codes (per spec "Sync server uses defined close codes"):
 *   4401  authentication failed mid-session
 *   4403  permission revoked / unauthorized
 *   4404  canvas deleted
 *   4429  rate-limit
 *   4001  server-initiated graceful close (room idle release / shutdown)
 *
 * Note: the application-defined 4xxx range is used end-to-end so the codes
 * survive Bun's WebSocket normalization (Bun rewrites standard 1001 →
 * 1000 when sent explicitly via `ws.close`).
 *
 * Design: "tldraw Sync Server 架構" + "WebSocket 握手驗證" +
 *         "WebSocket 連線層 rate limit"
 */

import type { WebSocketMinimal } from "@tldraw/sync-core";
import type { Server, ServerWebSocket, WebSocketHandler } from "bun";
import type { RateLimiter } from "../lib/rate-limiter";
import { authenticateSyncHandshake, type SyncAuthDeps, type SyncRole } from "./auth";
import { checkSyncConnectLimits, type ConcurrentConnectionRegistry } from "./rate-limit";
import type { RoomRegistry, SyncRoomLike } from "./room";

export interface SyncSocketData {
  canvasId: string;
  sessionId: string;
  userId: string;
  role: SyncRole;
}

export interface SyncServerDeps {
  registry: RoomRegistry<SyncRoomLike>;
  rateLimiter: RateLimiter;
  connectionRegistry: ConcurrentConnectionRegistry;
  auth: SyncAuthDeps;
  /** Resolve the source IP for a request — defaults to header-based lookup. */
  resolveClientIp(req: Request): string;
}

export type RevocationScope =
  | { kind: "user"; userId: string }
  | { kind: "all-anonymous" }
  | { kind: "all" };

export interface SyncServer {
  fetch(req: Request, server: Server<SyncSocketData>): Promise<Response | undefined>;
  websocket: WebSocketHandler<SyncSocketData>;
  shutdown(): Promise<void>;
  /** True while a sync room exists for `canvasId` (regardless of count). */
  isCanvasInActiveRoom(canvasId: string): boolean;
  /** Close all sessions for `canvasId` with code 4404 and dispose the room. */
  notifyCanvasDeleted(canvasId: string): void;
  /**
   * Close affected WebSocket sessions when share / link state changes.
   * `kind:user` closes that user's sessions with 4403; `kind:all-anonymous`
   * closes anon: sessions with 4403; `kind:all` closes everything with
   * 4404 and disposes the room (canvas-deletion semantics).
   */
  notifyAccessRevoked(canvasId: string, scope: RevocationScope): void;
  /**
   * Returns the same `RoomRegistry` instance that the sync server uses
   * internally. Exposed so the Server tldraw Mutator (M12.1) and other
   * server-side write paths can route through the exact same active-room
   * map — eliminating "two registries diverged" bugs.
   */
  getRoomRegistry(): RoomRegistry<SyncRoomLike>;
}

const SYNC_PATH = /^\/sync\/([^/]+)$/;

const CLOSE_CODE = {
  AUTH_FAILED: 4401,
  FORBIDDEN: 4403,
  CANVAS_DELETED: 4404,
  RATE_LIMITED: 4429,
  SERVER_GOING_AWAY: 4001,
} as const;

function bunWsToMinimal(ws: ServerWebSocket<SyncSocketData>): WebSocketMinimal {
  return {
    send(data: string) {
      ws.send(data);
    },
    close(code?: number, reason?: string) {
      ws.close(code, reason);
    },
    get readyState() {
      return ws.readyState ?? 1;
    },
  };
}

function jsonResponse(
  body: object,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function createSyncServer(deps: SyncServerDeps): SyncServer {
  // Track open sockets per canvas so we can broadcast 4404 / 1001 directly.
  const sockets = new Map<string, Set<ServerWebSocket<SyncSocketData>>>();

  function trackSocket(ws: ServerWebSocket<SyncSocketData>): void {
    let set = sockets.get(ws.data.canvasId);
    if (!set) {
      set = new Set();
      sockets.set(ws.data.canvasId, set);
    }
    set.add(ws);
  }

  function untrackSocket(ws: ServerWebSocket<SyncSocketData>): void {
    const set = sockets.get(ws.data.canvasId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) sockets.delete(ws.data.canvasId);
  }

  async function fetch(
    req: Request,
    server: Server<SyncSocketData>,
  ): Promise<Response | undefined> {
    const url = new URL(req.url);
    const match = SYNC_PATH.exec(url.pathname);
    if (!match) return undefined;
    const canvasId = match[1] ?? "";

    // 1. Authenticate + authorize (401 / 404 / 403)
    const auth = await authenticateSyncHandshake(req, canvasId, deps.auth);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    // 2. Rate-limit (429)
    const ip = deps.resolveClientIp(req);
    const rl = checkSyncConnectLimits(deps.rateLimiter, deps.connectionRegistry, {
      userId: auth.userId,
      canvasId,
      ip,
    });
    if (!rl.allowed) {
      return jsonResponse({ error: "errors.rateLimit", retryAfter: rl.retryAfterSeconds }, 429, {
        "Retry-After": String(rl.retryAfterSeconds),
      });
    }

    // 3. Pre-acquire the room (hydrates from DB on first connect). Bumps the
    //    registry's per-canvas connection count; we MUST release on upgrade
    //    failure to keep the count consistent.
    await deps.registry.acquire(canvasId);
    deps.connectionRegistry.add(auth.userId, canvasId);

    // 4. Upgrade
    const sessionId = crypto.randomUUID();
    const data: SyncSocketData = {
      canvasId,
      sessionId,
      userId: auth.userId,
      role: auth.role,
    };
    if (!server.upgrade(req, { data })) {
      deps.registry.release(canvasId);
      deps.connectionRegistry.remove(auth.userId, canvasId);
      return new Response("upgrade failed", { status: 500 });
    }
    return undefined;
  }

  const websocket: WebSocketHandler<SyncSocketData> = {
    open(ws) {
      trackSocket(ws);
      const room = deps.registry.getRoom(ws.data.canvasId);
      if (!room) return;
      room.handleSocketConnect?.({
        sessionId: ws.data.sessionId,
        socket: bunWsToMinimal(ws),
        isReadonly: ws.data.role === "viewer",
      });
    },

    message(ws, data) {
      const room = deps.registry.getRoom(ws.data.canvasId);
      if (!room) return;
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      room.handleSocketMessage?.(ws.data.sessionId, text);
    },

    close(ws) {
      untrackSocket(ws);
      const room = deps.registry.getRoom(ws.data.canvasId);
      room?.handleSocketClose?.(ws.data.sessionId);
      deps.registry.release(ws.data.canvasId);
      deps.connectionRegistry.remove(ws.data.userId, ws.data.canvasId);
    },
  };

  function isCanvasInActiveRoom(canvasId: string): boolean {
    return deps.registry.getRoom(canvasId) !== undefined;
  }

  function notifyCanvasDeleted(canvasId: string): void {
    const set = sockets.get(canvasId);
    if (set) {
      for (const ws of set) {
        ws.close(CLOSE_CODE.CANVAS_DELETED, "canvas deleted");
      }
      sockets.delete(canvasId);
    }
    void deps.registry.disposeRoom(canvasId, { flush: false });
  }

  function notifyAccessRevoked(canvasId: string, scope: RevocationScope): void {
    if (scope.kind === "all") {
      notifyCanvasDeleted(canvasId);
      return;
    }
    const set = sockets.get(canvasId);
    if (!set) return;
    for (const ws of set) {
      if (scope.kind === "user" && ws.data.userId !== scope.userId) continue;
      if (scope.kind === "all-anonymous" && !ws.data.userId.startsWith("anon:")) continue;
      ws.close(CLOSE_CODE.FORBIDDEN, "access revoked");
    }
  }

  async function shutdown(): Promise<void> {
    for (const [, set] of sockets) {
      for (const ws of set) {
        ws.close(CLOSE_CODE.SERVER_GOING_AWAY, "server shutdown");
      }
    }
    sockets.clear();
    // Yield so Bun fires the close handlers (which call registry.release).
    await new Promise((resolve) => setTimeout(resolve, 0));
    await deps.registry.closeAll();
  }

  /**
   * Returns the same `RoomRegistry` instance that the sync server uses
   * internally. Exposed so the Server tldraw Mutator (M12.1) and other
   * server-side write paths can route through the exact same active-room
   * map — eliminating "two registries diverged" bugs.
   */
  function getRoomRegistry(): RoomRegistry<SyncRoomLike> {
    return deps.registry;
  }

  return {
    fetch,
    websocket,
    shutdown,
    isCanvasInActiveRoom,
    notifyCanvasDeleted,
    notifyAccessRevoked,
    getRoomRegistry,
  };
}
