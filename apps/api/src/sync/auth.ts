/**
 * Sync handshake auth — gates a WebSocket upgrade behind:
 *   1. session cookie validity   (errors.auth.unauthorized → 401)
 *   2. canvas existence          (errors.canvas.notFound  → 404)
 *   3. canvas role               (errors.canvas.forbidden → 403)
 *
 * Production wires `deps` to:
 *   - `apps/api/src/auth/index.ts` better-auth `getSession`
 *   - DB-backed canvas + canvas_shares lookup
 *
 * Tests inject mocks (`auth.test.ts`).
 *
 * Spec: multiplayer-sync — "WebSocket handshake authenticates the user via
 * session cookie" + "WebSocket handshake authorizes the user against the
 * canvas".
 */

export type SyncRole = "editor" | "viewer";

export interface SyncAuthDeps {
  /** Resolve the active session for a request (null if missing/expired). */
  resolveSession(req: Request): Promise<{ userId: string } | null>;
  /**
   * Resolve a canvas existence + role triple. The implementation SHALL
   * return:
   *   - { canvasExists: false, role: null }                  → 404
   *   - { canvasExists: true,  role: null }                  → 403
   *   - { canvasExists: true,  role: 'editor' | 'viewer' }   → ok
   */
  resolveCanvasRole(
    userId: string,
    canvasId: string,
  ): Promise<{ canvasExists: boolean; role: SyncRole | null }>;
}

export type SyncAuthResult =
  | { ok: true; userId: string; role: SyncRole }
  | { ok: false; status: 401 | 403 | 404; error: string };

const UNAUTHORIZED: SyncAuthResult = {
  ok: false,
  status: 401,
  error: "errors.auth.unauthorized",
};

const NOT_FOUND: SyncAuthResult = {
  ok: false,
  status: 404,
  error: "errors.canvas.notFound",
};

const FORBIDDEN: SyncAuthResult = {
  ok: false,
  status: 403,
  error: "errors.canvas.forbidden",
};

export async function authenticateSyncHandshake(
  req: Request,
  canvasId: string,
  deps: SyncAuthDeps,
): Promise<SyncAuthResult> {
  const session = await deps.resolveSession(req);
  if (!session) return UNAUTHORIZED;

  const canvas = await deps.resolveCanvasRole(session.userId, canvasId);
  if (!canvas.canvasExists) return NOT_FOUND;
  if (canvas.role === null) return FORBIDDEN;

  return { ok: true, userId: session.userId, role: canvas.role };
}
