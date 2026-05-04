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
import { eq, desc, and, ne } from "drizzle-orm";
import { TLSocketRoom, type RoomSnapshot } from "@tldraw/sync-core";
import { vellumStoreSchema } from "./sync/shape-schemas";

import { logger } from "./lib/logger";
import { RateLimiter } from "./lib/rate-limiter";
import { createAuthHandler, getAuth } from "./auth/index";
import { handleAccountRequest } from "./account/routes";
import { handleCanvasRequest } from "./canvas/index";
import { handleFolderRequest } from "./folder/index";
import { handleShareRequest, type ShareHandlerDeps } from "./share/index";
import { handleOgRequest, createInMemoryOgCache, type OgHandlerDeps } from "./og/index";
import { validateExternalUrl } from "./lib/validate-external-url";
import { renderShareInviteEmail } from "./email/templates/share-invite";
import { createMailpitEmailService } from "./email/mailpit";
import { getDb } from "./db/index";
import { canvases, canvasShares, canvasInvites, canvasShareLinks, users } from "./db/schema";
import { createSyncServer, type SyncServerDeps, type SyncSocketData } from "./sync/index";
import { createConcurrentConnectionRegistry } from "./sync/rate-limit";
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
  if (row.snapshot && typeof row.snapshot === "object" && "documents" in row.snapshot) {
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
      schema: vellumStoreSchema,
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
      if (canvas.ownerId === userId) return { canvasExists: true, role: "editor" };
      // add-sharing: shared editor / shared viewer via canvas_shares.
      const share = await db.query.canvasShares.findFirst({
        where: (t, { eq: eq_, and: and_ }) =>
          and_(eq_(t.canvasId, canvasId), eq_(t.userId, userId)),
      });
      if (share) return { canvasExists: true, role: share.role };
      return { canvasExists: true, role: null };
    },
    async resolveCanvasShareLink(token) {
      const db = getDb();
      const link = await db.query.canvasShareLinks.findFirst({
        where: (t, { eq: eq_ }) => eq_(t.token, token),
        columns: { canvasId: true, mode: true },
      });
      return link ?? null;
    },
  },
  resolveClientIp(req) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
    return req.headers.get("x-real-ip") ?? "unknown";
  },
};

const syncServer = createSyncServer(syncDeps);

// ---------------------------------------------------------------------------
// Sharing wiring
// ---------------------------------------------------------------------------

const emailService = createMailpitEmailService({
  SMTP_HOST: Bun.env.SMTP_HOST ?? "localhost",
  SMTP_PORT: Bun.env.SMTP_PORT ?? "1025",
  SMTP_FROM: Bun.env.SMTP_FROM ?? "Vellum <noreply@vellum.test>",
});

const APP_BASE_URL = Bun.env.APP_BASE_URL ?? "http://localhost:3002";

const shareDeps: ShareHandlerDeps = {
  rateLimiter,
  async loadCanvas(canvasId) {
    const db = getDb();
    const c = await db.query.canvases.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.id, canvasId),
      columns: { id: true, ownerId: true, title: true },
    });
    return c ?? null;
  },
  async findUserByEmail(email) {
    const db = getDb();
    const u = await db.query.users.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.email, email),
      columns: { id: true, email: true, name: true },
    });
    return u ?? null;
  },
  async loadUser(userId) {
    const db = getDb();
    const u = await db.query.users.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.id, userId),
      columns: { id: true, email: true, name: true },
    });
    return u ?? null;
  },
  async listShares(canvasId) {
    const db = getDb();
    const rows = await db.select().from(canvasShares).where(eq(canvasShares.canvasId, canvasId));
    return rows.map((r) => ({
      canvasId: r.canvasId,
      userId: r.userId,
      role: r.role,
      createdAt: r.createdAt,
    }));
  },
  async loadShare(canvasId, userId) {
    const db = getDb();
    const row = await db
      .select()
      .from(canvasShares)
      .where(and(eq(canvasShares.canvasId, canvasId), eq(canvasShares.userId, userId)))
      .limit(1);
    const r = row[0];
    return r
      ? { canvasId: r.canvasId, userId: r.userId, role: r.role, createdAt: r.createdAt }
      : null;
  },
  async upsertShare(record) {
    const db = getDb();
    await db
      .insert(canvasShares)
      .values({
        canvasId: record.canvasId,
        userId: record.userId,
        role: record.role,
        createdAt: record.createdAt,
      })
      .onConflictDoUpdate({
        target: [canvasShares.canvasId, canvasShares.userId],
        set: { role: record.role },
      });
  },
  async deleteShare(canvasId, userId) {
    const db = getDb();
    await db
      .delete(canvasShares)
      .where(and(eq(canvasShares.canvasId, canvasId), eq(canvasShares.userId, userId)));
  },
  async listInvites(canvasId) {
    const db = getDb();
    const rows = await db.select().from(canvasInvites).where(eq(canvasInvites.canvasId, canvasId));
    return rows.map((r) => ({
      id: r.id,
      canvasId: r.canvasId,
      email: r.email,
      role: r.role,
      token: r.token,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  },
  async loadInvite(inviteId) {
    const db = getDb();
    const row = await db.query.canvasInvites.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.id, inviteId),
    });
    return row
      ? {
          id: row.id,
          canvasId: row.canvasId,
          email: row.email,
          role: row.role,
          token: row.token,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
        }
      : null;
  },
  async findInviteByCanvasAndEmail(canvasId, email) {
    const db = getDb();
    const row = await db.query.canvasInvites.findFirst({
      where: (t, { eq: eq_, and: and_ }) =>
        and_(eq_(t.canvasId, canvasId), eq_(t.email, email.toLowerCase())),
    });
    return row
      ? {
          id: row.id,
          canvasId: row.canvasId,
          email: row.email,
          role: row.role,
          token: row.token,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
        }
      : null;
  },
  async findInviteByToken(token) {
    const db = getDb();
    const row = await db.query.canvasInvites.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.token, token),
    });
    return row
      ? {
          id: row.id,
          canvasId: row.canvasId,
          email: row.email,
          role: row.role,
          token: row.token,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
        }
      : null;
  },
  async createInvite(record) {
    const db = getDb();
    await db.insert(canvasInvites).values({
      id: record.id,
      canvasId: record.canvasId,
      email: record.email.toLowerCase(),
      role: record.role,
      token: record.token,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    });
  },
  async deleteInvite(inviteId) {
    const db = getDb();
    await db.delete(canvasInvites).where(eq(canvasInvites.id, inviteId));
  },
  async loadLink(canvasId) {
    const db = getDb();
    const row = await db.query.canvasShareLinks.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.canvasId, canvasId),
    });
    return row ?? null;
  },
  async upsertLink(record) {
    const db = getDb();
    await db
      .insert(canvasShareLinks)
      .values({
        canvasId: record.canvasId,
        token: record.token,
        mode: record.mode,
        createdAt: record.createdAt,
        rotatedAt: record.rotatedAt,
      })
      .onConflictDoUpdate({
        target: canvasShareLinks.canvasId,
        set: {
          token: record.token,
          mode: record.mode,
          rotatedAt: record.rotatedAt,
        },
      });
  },
  async sendInviteEmail(args) {
    // The handler emits a generic subject/body; render the React Email
    // template here so the recipient gets a polished message. The handler's
    // `args.subject` is overridden by the rendered template's locale-aware
    // subject; `args.token` is used to build the accept URL.
    const acceptUrl = `${APP_BASE_URL}/api/share/invite/${args.token}/accept`;
    // We don't have the inviter / canvas-title at this layer; the share
    // handler called us with an interpolated subject — pull both back out
    // by parsing it. (Phase 2: refactor the dep contract to pass these
    // explicitly so we don't reverse-engineer the subject string.)
    const rendered = await renderShareInviteEmail({
      inviterName: "Vellum",
      canvasTitle: args.subject.replace(/^.* invited you to "/, "").replace(/" on Vellum$/, ""),
      acceptUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      locale: "en",
    });
    await emailService.send({
      to: args.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  },
  notifyAccessRevoked(canvasId, scope) {
    syncServer.notifyAccessRevoked(canvasId, scope);
  },
  now: () => new Date(),
};

const canvasDeps = {
  isCanvasInActiveRoom: (canvasId: string) => syncServer.isCanvasInActiveRoom(canvasId),
  async listSharedCanvases(userId: string) {
    const db = getDb();
    const rows = await db
      .select({
        id: canvases.id,
        ownerId: canvases.ownerId,
        folderId: canvases.folderId,
        title: canvases.title,
        snapshot: canvases.snapshot,
        createdAt: canvases.createdAt,
        updatedAt: canvases.updatedAt,
      })
      .from(canvasShares)
      .innerJoin(canvases, eq(canvasShares.canvasId, canvases.id))
      .where(and(eq(canvasShares.userId, userId), ne(canvases.ownerId, userId)))
      .orderBy(desc(canvases.updatedAt));
    return rows.map((r) => ({
      ...r,
      snapshot: (r.snapshot ?? {}) as object,
    }));
  },
  async loadCanvas(canvasId: string) {
    const db = getDb();
    const c = await db.query.canvases.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.id, canvasId),
    });
    if (!c) return null;
    return {
      id: c.id,
      ownerId: c.ownerId,
      folderId: c.folderId,
      title: c.title,
      snapshot: (c.snapshot ?? {}) as object,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  },
  async loadCanvasShareRow(canvasId: string, userId: string) {
    const db = getDb();
    const row = await db.query.canvasShares.findFirst({
      where: (t, { eq: eq_, and: and_ }) => and_(eq_(t.canvasId, canvasId), eq_(t.userId, userId)),
      columns: { role: true },
    });
    return row ? { role: row.role } : null;
  },
  async resolveCanvasShareLink(token: string) {
    const db = getDb();
    const link = await db.query.canvasShareLinks.findFirst({
      where: (t, { eq: eq_ }) => eq_(t.token, token),
      columns: { canvasId: true, mode: true },
    });
    return link ?? null;
  },
};

// ---------------------------------------------------------------------------
// Open Graph metadata endpoint (Link card shape)
// ---------------------------------------------------------------------------

const ogCache = createInMemoryOgCache({ capacity: 1_000 });

const ogDeps: OgHandlerDeps = {
  validateExternalUrl,
  async fetch(targetUrl) {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5_000);
    try {
      const resp = await fetch(targetUrl, { signal: ac.signal, redirect: "follow" });
      const contentType = resp.headers.get("content-type") ?? "";
      // Read body up to a 5 MB cap; abort if exceeded.
      let body = "";
      if (resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let total = 0;
        const MAX = 5 * 1024 * 1024;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX) {
            ac.abort();
            throw new Error("response too large");
          }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      }
      return {
        ok: resp.ok,
        status: resp.status,
        contentType,
        text: async () => body,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
  now: () => Date.now(),
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

    // Sharing routes — both `/api/canvas/:id/share/*` and the anonymous-
    // accessible `/api/share/invite/:token/accept` go through one handler.
    if (
      url.pathname.startsWith("/api/share/") ||
      /^\/api\/canvas\/[^/]+\/share/.test(url.pathname)
    ) {
      const session = await getSession(req);
      const shareResponse = await handleShareRequest(req, session, shareDeps);
      if (shareResponse) return respond(shareResponse);
    }

    // OG metadata endpoint (Link card shape)
    if (url.pathname === "/api/og" && req.method === "POST") {
      const session = await getSession(req);
      const ogResponse = await handleOgRequest(req, session, rateLimiter, ogDeps, ogCache);
      return respond(ogResponse);
    }

    // Account routes (protected)
    if (url.pathname.startsWith("/api/account")) {
      const accountResponse = await handleAccountRequest(req);
      if (accountResponse) return respond(accountResponse);
    }

    // Canvas routes (protected — resolve session once, pass to handler)
    if (url.pathname.startsWith("/api/canvas")) {
      const session = await getSession(req);
      const canvasResponse = await handleCanvasRequest(req, session, rateLimiter, canvasDeps);
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
