/**
 * Sync handshake auth — resolves up to TWO access offers per request:
 *
 *   1. Session-cookie offer → resolveSession + resolveCanvasRole
 *      - Owner / shared editor / shared viewer get role from canvas_shares.
 *
 *   2. Public-link-token offer (when URL has `?token=...`) → resolveCanvasShareLink
 *      - `view` or `edit` mode grants the corresponding role.
 *      - `closed` mode grants nothing.
 *
 * The handshake takes max(cookie role, token role) so:
 *   - logged-in non-members can enter via a public link (the owner has
 *     intentionally exposed access to anyone with the URL),
 *   - editors are never downgraded by a view-mode link they happen to click,
 *   - viewer members can be upgraded by an edit-mode public link (anonymous
 *     visitors get the same upgrade — denying it to a member would be
 *     surprising and worse for collaboration).
 *
 * `userId` is `session.userId` whenever a session is present (even if access
 * derives from the token); otherwise `anon:<8-char>`.
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

/** editor outranks viewer; null means "no offer". */
function maxRole(a: SyncRole | null, b: SyncRole | null): SyncRole | null {
  if (a === "editor" || b === "editor") return "editor";
  if (a === "viewer" || b === "viewer") return "viewer";
  return null;
}

function tokenOfferedRole(
  link: { canvasId: string; mode: "closed" | "view" | "edit" } | null,
  canvasId: string,
): SyncRole | null {
  if (!link || link.canvasId !== canvasId) return null;
  if (link.mode === "edit") return "editor";
  if (link.mode === "view") return "viewer";
  return null;
}

export async function authenticateSyncHandshake(
  req: Request,
  canvasId: string,
  deps: SyncAuthDeps,
): Promise<SyncAuthResult> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const session = await deps.resolveSession(req);
  const tokenLink = token ? await deps.resolveCanvasShareLink(token) : null;
  const tokenRole = tokenOfferedRole(tokenLink, canvasId);

  // Authenticated path — cookie present.
  if (session) {
    const canvas = await deps.resolveCanvasRole(session.userId, canvasId);
    if (!canvas.canvasExists) return NOT_FOUND;
    const effective = maxRole(canvas.role, tokenRole);
    if (effective === null) return FORBIDDEN;
    return { ok: true, userId: session.userId, role: effective };
  }

  // Anonymous path — no cookie. Only the token can grant access.
  if (tokenRole !== null) {
    return { ok: true, userId: generateAnonId(), role: tokenRole };
  }

  // No cookie + no usable token: distinguish unauth vs forbidden by whether
  // the caller offered a token at all (offered-but-bad → 403, none → 401).
  if (token !== null) return FORBIDDEN;
  return UNAUTHORIZED;
}
