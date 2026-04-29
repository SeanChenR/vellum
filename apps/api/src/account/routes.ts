/**
 * Account routes.
 *
 * Protected endpoints for profile management, session management, and
 * account deletion. All routes require an active session (enforced by
 * the protected route guard).
 *
 * Endpoints:
 *   GET    /api/account/profile
 *   PATCH  /api/account/profile
 *   GET    /api/account/sessions
 *   DELETE /api/account/sessions/:id
 *   DELETE /api/account
 */

import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../db/index";
import { users, sessions, verifications } from "../db/schema";
import { requireAuth } from "../auth/route-guard";
import { validateProfilePatch } from "./profile-validator";
import { validateDeleteAccount } from "./delete-account-validator";
import { logger } from "../lib/logger";
import { getAuth } from "../auth/index";

function errorJson(status: number, errorKey: string): Response {
  return Response.json({ error: { errorKey } }, { status });
}

/**
 * Get session from request using better-auth.
 */
async function getSession(
  req: Request,
): Promise<{ id: string; userId: string; revokedAt: Date | null } | null> {
  const auth = getAuth();
  try {
    const sessionResult = await auth.api.getSession({ headers: req.headers });
    if (!sessionResult?.session) return null;
    const sess = sessionResult.session as {
      id: string;
      userId: string;
      revokedAt?: Date | null;
    };
    return { id: sess.id, userId: sess.userId, revokedAt: sess.revokedAt ?? null };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/account/profile
// ---------------------------------------------------------------------------

async function handleGetProfile(req: Request): Promise<Response> {
  const session = await getSession(req);
  const guard = requireAuth(session);
  if (guard) return guard;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, session!.userId),
  });

  if (!user) {
    return errorJson(404, "account.errors.userNotFound");
  }

  return Response.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      locale: user.locale,
      createdAt: user.createdAt,
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/account/profile
// ---------------------------------------------------------------------------

async function handlePatchProfile(req: Request): Promise<Response> {
  const session = await getSession(req);
  const guard = requireAuth(session);
  if (guard) return guard;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorJson(400, "account.errors.invalidBody");
  }

  const validation = validateProfilePatch(
    body as Parameters<typeof validateProfilePatch>[0],
  );
  if (!validation.success) {
    return errorJson(400, validation.errorKey);
  }

  const db = getDb();
  const updates = {
    ...validation.data,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session!.userId))
    .returning();

  if (!updated) {
    return errorJson(404, "account.errors.userNotFound");
  }

  return Response.json({
    data: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      image: updated.image,
      locale: updated.locale,
      createdAt: updated.createdAt,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/account/sessions
// ---------------------------------------------------------------------------

async function handleGetSessions(req: Request): Promise<Response> {
  const session = await getSession(req);
  const guard = requireAuth(session);
  if (guard) return guard;

  const db = getDb();

  // better-auth sessions don't have a revoked_at column in the standard schema;
  // we filter by expiry — sessions table only shows non-expired entries.
  // In a custom revoke flow we'd mark revokedAt; for now list all active.
  const allSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, session!.userId));

  const now = new Date();
  const activeSessions = allSessions
    .filter((s) => s.expiresAt > now)
    .map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastSeenAt: s.updatedAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isCurrent: s.id === session!.id,
    }));

  return Response.json({ data: { sessions: activeSessions } });
}

// ---------------------------------------------------------------------------
// DELETE /api/account/sessions/:id
// ---------------------------------------------------------------------------

async function handleRevokeSession(
  req: Request,
  sessionId: string,
): Promise<Response> {
  const session = await getSession(req);
  const guard = requireAuth(session);
  if (guard) return guard;

  const db = getDb();

  // Verify the session belongs to the authenticated user
  const target = await db.query.sessions.findFirst({
    where: (s, { eq, and }) =>
      and(eq(s.id, sessionId), eq(s.userId, session!.userId)),
  });

  if (!target) {
    return errorJson(404, "account.errors.sessionNotFound");
  }

  try {
    const auth = getAuth();
    await auth.api.revokeSession({ headers: req.headers, body: { token: target.token } });
  } catch (err) {
    logger.error({ err, sessionId }, "revokeSession error");
    // Fallback: delete the row directly
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  const isCurrentSession = sessionId === session!.id;
  const headers: Record<string, string> = {};

  if (isCurrentSession) {
    // Clear the session cookie
    headers["set-cookie"] =
      "vellum.session_token=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/";
  }

  return new Response(JSON.stringify({ data: { ok: true } }), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/account
// ---------------------------------------------------------------------------

async function handleDeleteAccount(req: Request): Promise<Response> {
  const session = await getSession(req);
  const guard = requireAuth(session);
  if (guard) return guard;

  let body: { confirmEmail?: string };
  try {
    body = (await req.json()) as { confirmEmail?: string };
  } catch {
    return errorJson(400, "account.errors.invalidBody");
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, session!.userId),
  });

  if (!user) {
    return errorJson(404, "account.errors.userNotFound");
  }

  const validation = validateDeleteAccount(body, user.email);
  if (!validation.valid) {
    return errorJson(400, validation.errorKey);
  }

  // Explicitly delete verifications by identifier (email): better-auth's
  // verifications table uses identifier (email), not userId FK, so it cannot
  // CASCADE from the users table. Clean it up manually before deleting the user.
  await db
    .delete(verifications)
    .where(eq(verifications.identifier, user.email));

  // Cascade delete: sessions + accounts cascade via userId FK ON DELETE CASCADE.
  await db.delete(users).where(eq(users.id, user.id));

  logger.info({ userId: user.id }, "account deleted");

  return new Response(
    JSON.stringify({ data: { ok: true } }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie":
          "vellum.session_token=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/",
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Router — dispatches /api/account/* requests
// ---------------------------------------------------------------------------

export async function handleAccountRequest(
  req: Request,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  if (!path.startsWith("/api/account")) {
    return null;
  }

  // GET /api/account/profile
  if (method === "GET" && path === "/api/account/profile") {
    return handleGetProfile(req);
  }

  // PATCH /api/account/profile
  if (method === "PATCH" && path === "/api/account/profile") {
    return handlePatchProfile(req);
  }

  // GET /api/account/sessions
  if (method === "GET" && path === "/api/account/sessions") {
    return handleGetSessions(req);
  }

  // DELETE /api/account/sessions/:id
  const sessionRevokeMatch = path.match(/^\/api\/account\/sessions\/(.+)$/);
  if (method === "DELETE" && sessionRevokeMatch) {
    const sessionId = sessionRevokeMatch[1];
    if (!sessionId) return errorJson(400, "account.errors.invalidRequest");
    return handleRevokeSession(req, sessionId);
  }

  // DELETE /api/account
  if (method === "DELETE" && path === "/api/account") {
    return handleDeleteAccount(req);
  }

  return null;
}
