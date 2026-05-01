/**
 * Vellum API entry point — single Bun.serve process (HTTP + WebSocket).
 *
 * Route priority:
 *   1. /sync/:canvasId  — multiplayer sync WebSocket upgrade
 *   2. /health          — always available (no auth)
 *   3. /api/auth/*      — better-auth handler (rate-limited)
 *   4. /api/account/*   — account management (protected)
 *   5. /api/canvas/*    — canvas CRUD (protected) + active-room 409 gate
 *   6. /api/folder/*    — folder CRUD (protected)
 *   7. Catch-all stub
 *
 * Middleware order (HTTP):
 *   Sync handshake → RateLimiter singleton → Auth handler → Account handler →
 *   Canvas handler → Folder handler → Fallback
 *
 * Session resolution:
 *   Canvas and folder handlers receive the resolved session (or null) so
 *   they can be tested without an HTTP server.
 */

import { VELLUM_VERSION } from "@vellum/shared";
import { eq } from "drizzle-orm";
import { TLSocketRoom, type RoomSnapshot } from "@tldraw/sync-core";

import { logger } from "./lib/logger";
import { RateLimiter } from "./lib/rate-limiter";
import { createAuthHandler, getAuth } from "./auth/index";
import { handleAccountRequest } from "./account/routes";
import { handleCanvasRequest } from "./canvas/index";
import { handleFolderRequest } from "./folder/index";
import { getDb } from "./db/index";
import { canvases } from "./db/schema";
import { createSyncServer, type SyncServerDeps, type SyncSocketData } from "./sync/index";
import {
  createConcurrentConnectionRegistry,
} from "./sync/rate-limit";
import { RoomRegistry, type SyncRoomLike } from "./sync/room";

const PORT = Number(Bun.env.PORT ?? 3000);

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

const rateLimiter = new RateLimiter({ capacity: 10_000 });
const authHandler = createAuthHandler(rateLimiter);

/**
 * Resolve the authenticated session for a request.
 * Returns null for unauthenticated requests (canvas/folder handlers check this).
 */
async function getSession(req: Request): Promise<{ userId: string } | null> {
  const auth = getAuth();
  try {
    const result = await auth.api.getSession({ headers: req.headers });
    if (!result?.session) return null;
    const sess = result.session as { userId: string; revokedAt?: Date | null };
    if (sess.revokedAt) return null;
    return { userId: sess.userId };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Multiplayer sync wiring
// ---------------------------------------------------------------------------

async function loadSnapshotFromDb(canvasId: string): Promise<RoomSnapshot | undefined> {
  const db = getDb();
  const row = await db.query.canvases.findFirst({
    where: (c, { eq: eq_ }) => eq_(c.id, canvasId),
    columns: { snapshot: true },
  });
  if (!row) return undefined;
  // canvases.snapshot defaults to {} for newly created canvases — hand the
  // empty object to TLSocketRoom unchanged so it boots an empty store.
  if (
    row.snapshot &&
    typeof row.snapshot === "object" &&
    "documents" in row.snapshot
  ) {
    return row.snapshot as RoomSnapshot;
  }
  return undefined;
}

async function saveSnapshotToDb(canvasId: string, snapshot: RoomSnapshot): Promise<void> {
  const db = getDb();
  await db
    .update(canvases)
    .set({ snapshot, updatedAt: new Date() })
    .where(eq(canvases.id, canvasId));
}

const syncRegistry: RoomRegistry<SyncRoomLike> = new RoomRegistry<SyncRoomLike>({
  createRoom(_canvasId, initialSnapshot) {
    return new TLSocketRoom({
      initialSnapshot,
    }) as unknown as SyncRoomLike;
  },
  loadSnapshot: loadSnapshotFromDb,
  saveSnapshot: saveSnapshotToDb,
  setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  idleReleaseMs: 60_000,
});

const connectionRegistry = createConcurrentConnectionRegistry();

const syncDeps: SyncServerDeps = {
  registry: syncRegistry,
  rateLimiter,
  connectionRegistry,
  auth: {
    resolveSession: getSession,
    async resolveCanvasRole(userId, canvasId) {
      const db = getDb();
      const canvas = await db.query.canvases.findFirst({
        where: (c, { eq: eq_ }) => eq_(c.id, canvasId),
        columns: { ownerId: true },
      });
      if (!canvas) return { canvasExists: false, role: null };
      // Phase 1: only owner has a role. add-sharing extends this with
      // canvas_shares lookups for shared editor / shared viewer.
      if (canvas.ownerId === userId) return { canvasExists: true, role: "editor" };
      return { canvasExists: true, role: null };
    },
  },
  resolveClientIp(req) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
    return req.headers.get("x-real-ip") ?? "unknown";
  },
};

const syncServer = createSyncServer(syncDeps);

const canvasDeps = {
  isCanvasInActiveRoom: (canvasId: string) =>
    syncServer.isCanvasInActiveRoom(canvasId),
};

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Bun.serve<SyncSocketData>({
  port: PORT,

  async fetch(req, srv) {
    const url = new URL(req.url);
    const start = performance.now();

    const respond = (response: Response) => {
      const duration = Math.round(performance.now() - start);
      logger.debug(
        {
          method: req.method,
          path: url.pathname,
          status: response.status,
          duration,
        },
        "request",
      );
      return response;
    };

    // Multiplayer sync — must run before HTTP routes so /sync/:id never
    // collides with /api/* paths.
    if (url.pathname.startsWith("/sync/")) {
      const syncResponse = await syncServer.fetch(req, srv);
      if (syncResponse) return respond(syncResponse);
      // undefined → upgrade succeeded; Bun has taken over the socket.
      return undefined as unknown as Response;
    }

    // Health check
    if (url.pathname === "/health") {
      return respond(Response.json({ status: "ok", version: VELLUM_VERSION }));
    }

    // Auth routes
    if (url.pathname.startsWith("/api/auth")) {
      const authResponse = await authHandler(req);
      if (authResponse) return respond(authResponse);
    }

    // Account routes (protected)
    if (url.pathname.startsWith("/api/account")) {
      const accountResponse = await handleAccountRequest(req);
      if (accountResponse) return respond(accountResponse);
    }

    // Canvas routes (protected — resolve session once, pass to handler)
    if (url.pathname.startsWith("/api/canvas")) {
      const session = await getSession(req);
      const canvasResponse = await handleCanvasRequest(
        req,
        session,
        rateLimiter,
        canvasDeps,
      );
      if (canvasResponse) return respond(canvasResponse);
    }

    // Folder routes (protected — resolve session once, pass to handler)
    if (url.pathname.startsWith("/api/folder")) {
      const session = await getSession(req);
      const folderResponse = await handleFolderRequest(req, session, rateLimiter);
      if (folderResponse) return respond(folderResponse);
    }

    // Fallback stub
    return respond(
      new Response("Vellum API — see docs/PRD.md.", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
  },

  websocket: syncServer.websocket,
});

// Graceful shutdown — flush sync rooms, close all WS, then stop the server.
async function shutdownGracefully(signal: string): Promise<void> {
  logger.info({ signal }, "shutdown requested; flushing sync state");
  try {
    await syncServer.shutdown();
  } catch (err) {
    logger.error({ err: String(err) }, "error during sync server shutdown");
  }
  server.stop(true);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdownGracefully("SIGTERM"));
process.on("SIGINT", () => void shutdownGracefully("SIGINT"));

logger.info(
  { port: server.port, version: VELLUM_VERSION },
  "vellum api listening (HTTP + sync WebSocket on /sync/:canvasId)",
);
