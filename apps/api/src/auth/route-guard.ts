/**
 * Protected route guard.
 *
 * `requireAuth` is a helper used by every protected endpoint.
 * It returns a 401 Response when the session is absent or revoked,
 * or `null` when the request may proceed.
 */

interface SessionLike {
  id: string;
  userId: string;
  revokedAt?: Date | null;
}

/**
 * Check whether a session is present and active.
 *
 * @returns `Response` (401) to short-circuit the handler, or `null` to proceed.
 */
export function requireAuth(session: SessionLike | null | undefined): Response | null {
  if (!session) {
    return errorResponse(401, "auth.errors.notAuthenticated");
  }

  if (session.revokedAt) {
    return errorResponse(401, "auth.errors.sessionRevoked");
  }

  return null;
}

function errorResponse(status: number, errorKey: string): Response {
  return Response.json({ error: { errorKey } }, { status });
}
