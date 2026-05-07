/**
 * permission-guard.ts — write-side AI authorization deep module.
 *
 * One function (`requireRole`), one deps interface (`PermissionGuardDeps`),
 * one discriminated result type (`RequireRoleResult`). Phase 2 server-side
 * AI write endpoints (M13/M14) call this once before dispatching any
 * canvas-mutating operation; the dev-only mutate endpoint is the first
 * integration as a reference.
 *
 * The guard does NOT resolve sessions, parse cookies, or read public-link
 * tokens — those concerns belong to the calling endpoint's session
 * middleware. The guard does NOT cache role lookups; each call delegates
 * to `deps.resolveCanvasRole` exactly once on paths that require it.
 *
 * Spec: openspec/changes/add-permission-guard/specs/permission-guard/spec.md
 */

export type CanvasRole = "owner" | "editor" | "viewer" | "anon";

export interface PermissionGuardDeps {
  /**
   * Resolve `(userId, canvasId)` to the canvas's existence and the user's
   * role on it, if any. The production wiring points this at the same
   * resolver the sync handshake already uses (apps/api/src/index.ts).
   */
  resolveCanvasRole(
    userId: string,
    canvasId: string,
  ): Promise<{ canvasExists: boolean; role: CanvasRole | null }>;
}

export type RequireRoleResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 404;
      errorKey: "errors.auth.unauthorized" | "errors.canvas.notFound" | "errors.canvas.forbidden";
    };

const UNAUTHORIZED: RequireRoleResult = {
  ok: false,
  status: 401,
  errorKey: "errors.auth.unauthorized",
};

const NOT_FOUND: RequireRoleResult = {
  ok: false,
  status: 404,
  errorKey: "errors.canvas.notFound",
};

const FORBIDDEN: RequireRoleResult = {
  ok: false,
  status: 403,
  errorKey: "errors.canvas.forbidden",
};

/**
 * Decision matrix (applied in order; first match wins):
 *
 *   1. session === null                          → 401 unauthorized
 *   2. canvasExists === false                    → 404 notFound
 *   3. canvasExists === true && role === null    → 403 forbidden
 *   4. role NOT in allowed                       → 403 forbidden
 *   5. role IS in allowed                        → { ok: true }
 *
 * The order is fixed: step 1 wins over step 2 to avoid leaking
 * canvas-existence information to unauthenticated requests, and step 2
 * wins over step 3 so authenticated users see 404 (not 403) for canvases
 * that don't exist.
 */
export async function requireRole(
  deps: PermissionGuardDeps,
  session: { userId: string } | null,
  canvasId: string,
  allowed: ReadonlyArray<CanvasRole>,
): Promise<RequireRoleResult> {
  if (session === null) return UNAUTHORIZED;

  const canvas = await deps.resolveCanvasRole(session.userId, canvasId);
  if (!canvas.canvasExists) return NOT_FOUND;
  if (canvas.role === null) return FORBIDDEN;
  if (!allowed.includes(canvas.role)) return FORBIDDEN;
  return { ok: true };
}
