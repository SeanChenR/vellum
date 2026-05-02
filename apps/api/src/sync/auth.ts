/**
 * Sync handshake auth — gates a WebSocket upgrade through TWO paths:
 *
 *   1. Session-cookie path (default) → resolveSession + resolveCanvasRole
 *      - Owner / shared editor / shared viewer get role from canvas_shares
 *
 *   2. Public-link-token path (when URL has `?token=...`) → resolveCanvasShareLink
 *      - Anonymous-acceptable when mode is `view` or `edit`
 *      - userId becomes `anon:<8-char>` (or session.userId if cookie also valid)
 *
 * If both a valid session cookie AND a token are present, the cookie path
 * wins — logged-in editors don't get downgraded by clicking a public link.
 *
 * Spec: multiplayer-sync — MODIFIED "WebSocket handshake authenticates the
 * user via session cookie" + MODIFIED "WebSocket handshake authorizes the
 * user against the canvas"
 */

export type SyncRole = "editor" | "viewer";

export interface SyncAuthDeps {
  resolveSession(req: Request): Promise<{ userId: string } | null>;
  /**
   * Resolve the cookie-path role:
   *   - { canvasExists: false, role: null }                  → 404
   *   - { canvasExists: true,  role: null }                  → 403
   *   - { canvasExists: true,  role: 'editor' | 'viewer' }   → ok
   */
  resolveCanvasRole(
    userId: string,
    canvasId: string,
  ): Promise<{ canvasExists: boolean; role: SyncRole | null }>;
  /**
   * Resolve the public-link record by its share token. Returns null when
   * the token doesn't match a row.
   */
  resolveCanvasShareLink(
    token: string,
  ): Promise<{ canvasId: string; mode: "closed" | "view" | "edit" } | null>;
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

function generateAnonId(): string {
  // 8 hex chars from a 4-byte random buffer — collision-resistant enough
  // for in-memory presence keys; not a security boundary.
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return `anon:${Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function authenticateSyncHandshake(
  req: Request,
  canvasId: string,
  deps: SyncAuthDeps,
): Promise<SyncAuthResult> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // 1. Cookie path — preferred even when a token is present.
  const session = await deps.resolveSession(req);
  if (session) {
    const canvas = await deps.resolveCanvasRole(session.userId, canvasId);
    if (!canvas.canvasExists) return NOT_FOUND;
    if (canvas.role === null) return FORBIDDEN;
    return { ok: true, userId: session.userId, role: canvas.role };
  }

  // 2. Anonymous + token path.
  if (token) {
    const link = await deps.resolveCanvasShareLink(token);
    if (!link || link.canvasId !== canvasId) return FORBIDDEN;
    if (link.mode === "closed") return FORBIDDEN;
    const role: SyncRole = link.mode === "edit" ? "editor" : "viewer";
    return { ok: true, userId: generateAnonId(), role };
  }

  // 3. No cookie, no token → unauthenticated.
  return UNAUTHORIZED;
}
