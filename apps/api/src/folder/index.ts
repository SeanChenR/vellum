/**
 * Folder REST routes.
 *
 * Endpoints:
 *   POST   /api/folder          — create folder
 *   GET    /api/folder          — list owned folders (name asc)
 *   PATCH  /api/folder/:id      — rename folder
 *   DELETE /api/folder/:id      — delete folder (guarded: must be empty)
 *
 * Auth: all routes require an active session (passed from index.ts).
 *
 * Non-empty folder guard:
 *   DELETE returns 409 errors.folder.notEmpty if any canvas has folder_id = id.
 *   Folders are user-private; no sharing semantics apply.
 *
 * Spec: folder-management capability
 */

import { eq, count, asc } from "drizzle-orm";
import { getDb } from "../db/index";
import { folders, canvases } from "../db/schema";
import type { RateLimiter } from "../lib/rate-limiter";
import {
  FOLDER_CREATE_RULE,
  FOLDER_DELETE_RULE,
  FOLDER_LIST_RULE,
  FOLDER_UPDATE_RULE,
} from "../lib/rate-limit-rules";
import { folderCreateInputSchema, folderUpdateInputSchema } from "@vellum/shared/api-contract";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SessionLike {
  userId: string;
}

/**
 * Optional dependency hooks for `handleFolderRequest`. Production wiring
 * (apps/api/src/index.ts) leaves this undefined and the handler falls
 * back to direct `getDb()` queries — pre-DI behaviour preserved. Unit
 * tests inject `loadFolder` to exercise the not-found branch without
 * depending on `Bun.env.DATABASE_URL` (see fix-canvas-test-di-isolation).
 */
export interface FolderHandlerDeps {
  loadFolder?(folderId: string): Promise<{
    id: string;
    ownerId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
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
  return `api:folder:${action}:${userId}`;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCreate(
  req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("create", session.userId), FOLDER_CREATE_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResp(400, "errors.validation", { details: [{ message: "Invalid JSON" }] });
  }

  const parsed = folderCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResp(400, "errors.validation", { details: parsed.error.issues });
  }

  const db = getDb();
  const [folder] = await db
    .insert(folders)
    .values({
      ownerId: session.userId,
      name: parsed.data.name,
    })
    .returning();

  if (!folder) {
    return errorResp(500, "errors.internal");
  }

  return Response.json({ data: folderToDto(folder) }, { status: 201 });
}

async function handleList(
  _req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("list", session.userId), FOLDER_LIST_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  const db = getDb();
  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.ownerId, session.userId))
    .orderBy(asc(folders.name));

  return Response.json({
    data: rows.map(folderToDto),
    meta: { total: rows.length },
  });
}

async function handleUpdate(
  req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
  folderId: string,
  deps: FolderHandlerDeps,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("update", session.userId), FOLDER_UPDATE_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResp(400, "errors.validation", { details: [{ message: "Invalid JSON" }] });
  }

  const parsed = folderUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResp(400, "errors.validation", { details: parsed.error.issues });
  }

  // Existence check via injected deps when available; defers `getDb()`
  // so a 404-stub test never touches `Bun.env.DATABASE_URL`. See
  // fix-canvas-test-di-isolation.
  const folder = deps.loadFolder
    ? await deps.loadFolder(folderId)
    : await getDb().query.folders.findFirst({
        where: (f, { eq: eq_ }) => eq_(f.id, folderId),
      });

  if (!folder) {
    return errorResp(404, "errors.folder.notFound");
  }

  if (folder.ownerId !== session.userId) {
    return errorResp(403, "errors.folder.forbidden");
  }

  const [updated] = await getDb()
    .update(folders)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(folders.id, folderId))
    .returning();

  if (!updated) {
    return errorResp(500, "errors.internal");
  }

  return Response.json({ data: folderToDto(updated) });
}

async function handleDelete(
  _req: Request,
  session: SessionLike,
  rateLimiter: RateLimiter,
  folderId: string,
  deps: FolderHandlerDeps,
): Promise<Response> {
  const rl = rateLimiter.limit(rlKey("delete", session.userId), FOLDER_DELETE_RULE);
  if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

  // Existence check via deps when injected; defers `getDb()` so 404
  // tests never touch DATABASE_URL.
  const folder = deps.loadFolder
    ? await deps.loadFolder(folderId)
    : await getDb().query.folders.findFirst({
        where: (f, { eq: eq_ }) => eq_(f.id, folderId),
      });

  if (!folder) {
    return errorResp(404, "errors.folder.notFound");
  }

  if (folder.ownerId !== session.userId) {
    return errorResp(403, "errors.folder.forbidden");
  }

  // From here we definitely need DB access — safe to resolve once.
  const db = getDb();
  // Non-empty guard: reject delete if any canvas still references this folder
  const [countResult] = await db
    .select({ n: count() })
    .from(canvases)
    .where(eq(canvases.folderId, folderId));

  if ((countResult?.n ?? 0) > 0) {
    return errorResp(409, "errors.folder.notEmpty");
  }

  await db.delete(folders).where(eq(folders.id, folderId));

  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// DTO serialiser
// ---------------------------------------------------------------------------

type FolderRow = typeof folders.$inferSelect;

function folderToDto(f: FolderRow) {
  return {
    id: f.id,
    ownerId: f.ownerId,
    name: f.name,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Router entry point
// ---------------------------------------------------------------------------

const FOLDER_PREFIX = "/api/folder";

/**
 * Handle /api/folder/* requests.
 *
 * @param req         - Incoming request
 * @param session     - Resolved session from better-auth (null if unauthed)
 * @param rateLimiter - Shared RateLimiter singleton
 * @param deps        - Optional handler dependencies for testability. Production
 *                      wiring leaves this undefined (handler falls back to
 *                      direct DB queries).
 * @returns Response or null (caller continues routing)
 */
export async function handleFolderRequest(
  req: Request,
  session: SessionLike | null,
  rateLimiter: RateLimiter,
  deps: FolderHandlerDeps = {},
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  if (!path.startsWith(FOLDER_PREFIX)) return null;

  // Auth guard — all folder routes require a session
  if (!session) {
    return errorResp(401, "errors.auth.unauthorized");
  }

  const afterPrefix = path.slice(FOLDER_PREFIX.length);

  // POST /api/folder
  if (method === "POST" && (afterPrefix === "" || afterPrefix === "/")) {
    return handleCreate(req, session, rateLimiter);
  }

  // GET /api/folder (list)
  if (method === "GET" && (afterPrefix === "" || afterPrefix === "/")) {
    return handleList(req, session, rateLimiter);
  }

  // Routes with folder ID
  const idMatch = afterPrefix.match(/^\/([^/]+)$/);
  if (idMatch) {
    const folderId = idMatch[1]!;

    if (method === "PATCH") {
      return handleUpdate(req, session, rateLimiter, folderId, deps);
    }
    if (method === "DELETE") {
      return handleDelete(req, session, rateLimiter, folderId, deps);
    }
  }

  return null;
}
