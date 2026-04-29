/**
 * Permission deep module — canvas access control.
 *
 * Exports `canAccess(user, canvas, action)` which is the single source of
 * truth for all canvas permission checks in the API.
 *
 * Phase 1 rule (this change):
 *   - Owner (user.id === canvas.ownerId) → true for all actions
 *   - Non-owner or anonymous → false for all actions
 *
 * The function signature is intentionally stable: `add-sharing` will extend
 * the rule set (shared access, public link mode) without changing call sites.
 * All callers in canvas/folder route handlers call `canAccess()` directly —
 * they do not inline the owner check.
 *
 * Spec: "Permission contract for canvas actions"
 */

export type CanvasAction = "read" | "write" | "delete" | "share";

interface UserLike {
  id: string;
}

interface CanvasLike {
  ownerId: string;
}

/**
 * Check whether `user` may perform `action` on `canvas`.
 *
 * @param user  - Authenticated user (or null / undefined for anonymous).
 * @param canvas - Canvas row (must include `ownerId`).
 * @param action - One of: 'read' | 'write' | 'delete' | 'share'
 * @returns `true` if access is granted, `false` otherwise.
 *
 * Phase 1: true iff user is non-null and user.id === canvas.ownerId.
 * add-sharing will extend this to cover shared rows and public-link modes.
 */
export function canAccess(
  user: UserLike | null | undefined,
  canvas: CanvasLike,
  action: CanvasAction,
): boolean {
  // Suppress unused-parameter lint — action will be used when add-sharing
  // differentiates read/write/share per sharing mode.
  void action;

  if (!user) return false;
  return user.id === canvas.ownerId;
}
