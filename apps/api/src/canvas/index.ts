/**
 * Canvas REST routes.
 *
 * Endpoints:
 *   POST   /api/canvas          — create canvas
 *   GET    /api/canvas          — list canvases (scope + folderId filter)
 *   GET    /api/canvas/:id      — read one canvas
 *   PATCH  /api/canvas/:id      — rename / folder reassignment
 *   DELETE /api/canvas/:id      — delete canvas
 *
 * Auth: all routes require an active session (passed in from index.ts after
 * calling better-auth's getSession).
 *
 * Rate limits: per-user token-bucket rules from rate-limit-rules.ts.
 *
 * Error envelope: { error: ErrorKey }  (flat, matching api-contract.ts)
 * Success envelope: { data: T, meta?: { total: number } }
 *
 * Spec: canvas-management capability
 */

import { eq, and, isNull, desc } from "drizzle-orm";
import { getDb } from "../db/index";
import { canvases } from "../db/schema";
import { canAccess } from "../lib/permission";
import type { RateLimiter } from "../lib/rate-limiter";
import {
  CANVAS_CREATE_RULE,
  CANVAS_DELETE_RULE,
  CANVAS_LIST_RULE,
  CANVAS_READ_RULE,
  CANVAS_UPDATE_RULE,
} from "../lib/rate-limit-rules";
import { canvasCreateInputSchema, canvasUpdateInputSchema } from "@vellum/shared/api-contract";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SessionLike {
  userId: string;
}

/**
 * Optional dependencies the canvas handler consults but does not own:
 *   - `isCanvasInActiveRoom`: query the multiplayer-sync server's room
 *     registry to gate HTTP snapshot writes. Tests omit this so behavior
 *     remains opt-in.
 *   - `listSharedCanvases`: query canvases visible to the user via
 *     `canvas_shares`. Production wires it in `apps/api/src/index.ts`;
 *     tests pass an in-memory implementation. When omitted, the
 *     `scope=shared` path returns an empty array (M5 feature gate).
 *   - `loadCanvas` / `loadCanvasShareRow` / `resolveCanvasShareLink`:
 *     read paths used by `GET /api/canvas/:id` to recognise shared
 *     members and `?share=<token>` public-link visitors. Production
 *     wires DB queries; tests inject in-memory fakes. When omitted the
 *     handler falls back to direct DB access, matching pre-M5 behavior.
 */
export interface CanvasHandlerDeps {
  isCanvasInActiveRoom?(canvasId: string): boolean;
  listSharedCanvases?(userId: string): Promise<
    Array<{
      id: string;
      ownerId: string;
      folderId: string | null;
      title: string;
      snapshot: object;
      createdAt: Date;
      updatedAt: Date;
    }>
  >;
  loadCanvas?(canvasId: string): Promise<{
    id: string;
    ownerId: string;
    folderId: string | null;
    title: string;
    snapshot: object;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  loadCanvasShareRow?(
    canvasId: string,
    userId: string,
  ): Promise<{ role: "editor" | "viewer" } | null>;
  resolveCanvasShareLink?(
    token: string,
  ): Promise<{ canvasId: string; mode: "closed" | "view" | "edit" } | null>;
}

function errorResp(status: number, error: string, extra?: object): Response {
  return Response.json({ error, ...extra }, { status });
}

function rateLimitResp(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "errors.rateLimit", retryAfter: retryAfterSeconds }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}

function rlKey(action: string, userId: string) {
  return `api:canvas:${action}:${userId}`;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCreate(
  req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("create", session.userId), CANVAS_CREATE_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResp(400, "errors.validation", { details: [{ message: "Invalid JSON" }] });
  }

  const parsed = canvasCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResp(400, "errors.validation", { details: parsed.error.issues });
  }

  const { title, folderId } = parsed.data;

  // If folderId provided, verify it belongs to this user
  if (folderId !== undefined && folderId !== null) {
    const db = getDb();
    const folder = await db.query.folders.findFirst({
      where: (f, { eq: eq_ }) => eq_(f.id, folderId),
    });
    if (!folder) {
      return errorResp(403, "errors.folder.forbidden");
    }
    if (folder.ownerId !== session.userId) {
      return errorResp(403, "errors.folder.forbidden");
    }
  }

  const db = getDb();
  const [canvas] = await db
    .insert(canvases)
    .values({
      ownerId: session.userId,
      folderId: folderId ?? null,
      title,
    })
    .returning();

  if (!canvas) {
    return errorResp(500, "errors.internal");
  }

  return Response.json({ data: canvasToDto(canvas) }, { status: 201 });
}

async function handleList(
  req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
  deps: CanvasHandlerDeps,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("list", session.userId), CANVAS_LIST_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "owned";
  const folderIdParam = url.searchParams.get("folderId");

  if (scope === "shared") {
    // Shared scope is owned by the `add-sharing` capability. When the dep
    // is wired, return the user's accepted shares; otherwise the legacy
    // empty-array stub is preserved for callers that haven't migrated.
    const shared = deps.listSharedCanvases ? await deps.listSharedCanvases(session.userId) : [];
    return Response.json({
      data: shared.map(canvasToDto),
      meta: { total: shared.length },
    });
  }

  const db = getDb();
  let rows;

  if (folderIdParam === null) {
    // No folderId filter — return all owned canvases
    rows = await db
      .select()
      .from(canvases)
      .where(eq(canvases.ownerId, session.userId))
      .orderBy(desc(canvases.updatedAt));
  } else if (folderIdParam === "null") {
    // folderId=null — unfiled canvases only
    rows = await db
      .select()
      .from(canvases)
      .where(and(eq(canvases.ownerId, session.userId), isNull(canvases.folderId)))
      .orderBy(desc(canvases.updatedAt));
  } else {
    // folderId=<uuid> — verify folder ownership then filter
    const folder = await db.query.folders.findFirst({
      where: (f, { eq: eq_ }) => eq_(f.id, folderIdParam),
    });
    if (!folder) {
      return errorResp(403, "errors.folder.forbidden");
    }
    if (folder.ownerId !== session.userId) {
      return errorResp(403, "errors.folder.forbidden");
    }
    rows = await db
      .select()
      .from(canvases)
      .where(and(eq(canvases.ownerId, session.userId), eq(canvases.folderId, folderIdParam)))
      .orderBy(desc(canvases.updatedAt));
  }

  return Response.json({
    data: rows.map(canvasToDto),
    meta: { total: rows.length },
  });
}

async function handleRead(
  req: Request,
  session: SessionLike | null,
  rateLimiter: RateLimiter,
  canvasId: string,
  deps: CanvasHandlerDeps,
): Promise<Response> {
  const url = new URL(req.url);
  const shareToken = url.searchParams.get("share");

  // Rate-limit key: signed-in users key by userId; anonymous public-link
  // visitors key by token (token is opaque, so use a coarse prefix to
  // avoid leaking it into LRU keys via logs).
  const rlIdent = session?.userId ?? `anon:${shareToken ? shareToken.slice(0, 8) : "none"}`;
  const rl = rateLimiter.limit(rlKey("read", rlIdent), CANVAS_READ_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  // Resolve public-link token first so we can permit anonymous reads.
  // The link only counts when its canvasId matches the URL — token reuse
  // across canvases is rejected.
  let publicLinkMode: "closed" | "view" | "edit" | null = null;
  if (shareToken && deps.resolveCanvasShareLink) {
    const link = await deps.resolveCanvasShareLink(shareToken);
    if (link && link.canvasId === canvasId) {
      publicLinkMode = link.mode;
    }
  }

  const canvas = deps.loadCanvas
    ? await deps.loadCanvas(canvasId)
    : await getDb().query.canvases.findFirst({
        where: (c, { eq: eq_ }) => eq_(c.id, canvasId),
      });

  if (!canvas) {
    return errorResp(404, "errors.canvas.notFound");
  }

  let sharedRole: "editor" | "viewer" | null = null;
  if (session && deps.loadCanvasShareRow) {
    const row = await deps.loadCanvasShareRow(canvasId, session.userId);
    if (row) sharedRole = row.role;
  }

  const user = session ? { id: session.userId } : null;
  if (!canAccess(user, canvas, "read", { sharedRole, publicLinkMode })) {
    return errorResp(
      session ? 403 : 401,
      session ? "errors.canvas.forbidden" : "errors.auth.unauthorized",
    );
  }

  return Response.json({ data: canvasToDto(canvas) });
}

async function handleUpdate(
  req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
  canvasId: string,
  deps: CanvasHandlerDeps,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("update", session.userId), CANVAS_UPDATE_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResp(400, "errors.validation", { details: [{ message: "Invalid JSON" }] });
  }

  const parsed = canvasUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResp(400, "errors.validation", { details: parsed.error.issues });
  }

  const db = getDb();
  const canvas = await db.query.canvases.findFirst({
    where: (c, { eq: eq_ }) => eq_(c.id, canvasId),
  });

  if (!canvas) {
    return errorResp(404, "errors.canvas.notFound");
  }

  if (!canAccess({ id: session.userId }, canvas, "write")) {
    return errorResp(403, "errors.canvas.forbidden");
  }

  const { title, folderId, snapshot } = parsed.data;

  // Multiplayer-sync: HTTP-driven snapshot writes MUST NOT race with the
  // server-authoritative room state. If a sync room is currently active for
  // this canvas, reject with 409 (per `multiplayer-sync` spec).
  if (snapshot !== undefined && deps.isCanvasInActiveRoom?.(canvasId)) {
    return errorResp(409, "errors.canvas.activeRoom");
  }

  // If folderId is being set (not null and not undefined), verify ownership
  if (folderId !== undefined && folderId !== null) {
    const folder = await db.query.folders.findFirst({
      where: (f, { eq: eq_ }) => eq_(f.id, folderId),
    });
    if (!folder || folder.ownerId !== session.userId) {
      return errorResp(403, "errors.folder.forbidden");
    }
  }

  const updateValues: Partial<{
    title: string;
    folderId: string | null;
    snapshot: unknown;
    updatedAt: Date;
  }> = {
    updatedAt: new Date(),
  };
  if (title !== undefined) updateValues.title = title;
  if (folderId !== undefined) updateValues.folderId = folderId;
  if (snapshot !== undefined) updateValues.snapshot = snapshot;

  const [updated] = await db
    .update(canvases)
    .set(updateValues)
    .where(eq(canvases.id, canvasId))
    .returning();

  if (!updated) {
    return errorResp(500, "errors.internal");
  }

  return Response.json({ data: canvasToDto(updated) });
}

async function handleDelete(
  _req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
  canvasId: string,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("delete", session.userId), CANVAS_DELETE_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  const db = getDb();
  const canvas = await db.query.canvases.findFirst({
    where: (c, { eq: eq_ }) => eq_(c.id, canvasId),
  });

  if (!canvas) {
    return errorResp(404, "errors.canvas.notFound");
  }

  if (!canAccess({ id: session.userId }, canvas, "delete")) {
    return errorResp(403, "errors.canvas.forbidden");
  }

  await db.delete(canvases).where(eq(canvases.id, canvasId));

  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// DTO serialiser
// ---------------------------------------------------------------------------

type CanvasRow = typeof canvases.$inferSelect;

function canvasToDto(c: CanvasRow) {
  return {
    id: c.id,
    ownerId: c.ownerId,
    folderId: c.folderId,
    title: c.title,
    snapshot: c.snapshot,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Router entry point
// ---------------------------------------------------------------------------

const CANVAS_PREFIX = "/api/canvas";

/**
 * Handle /api/canvas/* requests.
 *
 * @param req       - Incoming request
 * @param session   - Resolved session from better-auth (null if unauthenticated)
 * @param rateLimiter - Shared RateLimiter singleton
 * @returns Response or null (caller continues routing)
 */
export async function handleCanvasRequest(
  req: Request,
  session: SessionLike | null,
  rateLimiter: RateLimiter,
  deps: CanvasHandlerDeps = {},
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  if (!path.startsWith(CANVAS_PREFIX)) return null;

  const afterPrefix = path.slice(CANVAS_PREFIX.length); // "" | "/" | "/<id>" | "/<id>/..."
  const idMatch = afterPrefix.match(/^\/([^/]+)$/);

  // Anonymous public-link visitors are allowed only on `GET /api/canvas/:id`
  // with a `?share=<token>` query. handleRead validates the token and
  // resolves access via canAccess; everywhere else still requires a session.
  if (!session) {
    const isPublicLinkRead = method === "GET" && idMatch !== null && url.searchParams.has("share");
    if (!isPublicLinkRead) {
      return errorResp(401, "errors.auth.unauthorized");
    }
  }

  // POST /api/canvas
  if (method === "POST" && (afterPrefix === "" || afterPrefix === "/")) {
    return handleCreate(req, session!, rateLimiter);
  }

  // GET /api/canvas (list)
  if (method === "GET" && (afterPrefix === "" || afterPrefix === "/")) {
    return handleList(req, session!, rateLimiter, deps);
  }

  // Routes that include a canvas ID
  if (idMatch) {
    const canvasId = idMatch[1]!;

    if (method === "GET") {
      return handleRead(req, session, rateLimiter, canvasId, deps);
    }
    if (method === "PATCH") {
      return handleUpdate(req, session!, rateLimiter, canvasId, deps);
    }
    if (method === "DELETE") {
      return handleDelete(req, session!, rateLimiter, canvasId);
    }
  }

  return null;
}
