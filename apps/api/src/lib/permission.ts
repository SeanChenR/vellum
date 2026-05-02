/**
 * Permission deep module — canvas access control.
 *
 * `canAccess(user, canvas, action, ctx?)` is the single source of truth
 * for canvas permissions. It combines ownership, share-row presence
 * (`canvas_shares`), and public-link mode (`canvas_share_links`) into a
 * boolean grant.
 *
 * The function is pure — callers prepare `ctx` from DB state and pass it
 * in. This keeps the predicate easy to unit test and lets a single DB
 * lookup answer multiple action questions.
 *
 * Spec: canvas-management — "Permission contract for canvas actions"
 */

export type CanvasAction = "read" | "write" | "delete" | "share";

interface UserLike {
  id: string;
}

interface CanvasLike {
  ownerId: string;
}

export interface PermissionContext {
  /** `canvas_shares.role` for (user, canvas), if any. */
  sharedRole?: "editor" | "viewer" | null;
  /** `canvas_share_links.mode` for the canvas, if a token-bearing request. */
  publicLinkMode?: "closed" | "view" | "edit" | null;
}

/**
 * Check whether `user` may perform `action` on `canvas`.
 *
 * Owner (`user.id === canvas.ownerId`) wins over any ctx — even an
 * accidental `sharedRole: 'viewer'` cannot downgrade them.
 *
 * For non-owners the strongest available signal applies; sharedRole is
 * preferred over publicLinkMode (a logged-in editor visiting via a closed
 * link still has editor access).
 */
export function canAccess(
  user: UserLike | null | undefined,
  canvas: CanvasLike,
  action: CanvasAction,
  ctx?: PermissionContext,
): boolean {
  // Owner: full access regardless of ctx.
  if (user?.id && user.id === canvas.ownerId) return true;

  // Logged-in shared editor: read + write.
  if (ctx?.sharedRole === "editor") {
    return action === "read" || action === "write";
  }

  // Logged-in shared viewer: read only.
  if (ctx?.sharedRole === "viewer") {
    return action === "read";
  }

  // Public-link visitor (logged-in or anonymous): role is determined by mode.
  switch (ctx?.publicLinkMode) {
    case "edit":
      return action === "read" || action === "write";
    case "view":
      return action === "read";
    case "closed":
      return false;
    default:
      // No relation, no link, no role.
      return false;
  }
}
