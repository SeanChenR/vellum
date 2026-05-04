/**
 * use-shape-edit-lock — first-editor-wins lock derived from tldraw
 * presence (no server-side lock table).
 *
 * The resolver is a pure function over `(shapeId, selfUserId, presences,
 * nowMs)` — easy to unit test. The React hook subscribes to tldraw's
 * presence reactivity and feeds the resolver. While we have multiplayer
 * presence in tldraw sync, callers that don't run inside a tldraw editor
 * context (e.g. tests, Storybook) can directly call `resolveEditLock`.
 *
 * Spec: multiplayer-sync — "Custom shapes enforce a first-editor-wins
 * edit lock during multiplayer sessions".
 *
 * ADR: docs/adr/0009-shape-edit-lock-vs-crdt.md
 */

import { useMemo } from "react";

export const STALE_LOCK_MS = 5 * 60 * 1000;

export interface ShapePresence {
  userId: string;
  userName: string;
  editingShapeId: string | null;
  lastActiveAt: number;
}

export interface LockedBy {
  userId: string;
  userName: string;
}

export interface EditLockState {
  canEdit: boolean;
  lockedBy: LockedBy | null;
}

export interface ResolveEditLockArgs {
  shapeId: string;
  selfUserId: string;
  presences: readonly ShapePresence[];
  nowMs: number;
}

export function resolveEditLock(args: ResolveEditLockArgs): EditLockState {
  const { shapeId, selfUserId, presences, nowMs } = args;
  const staleThreshold = nowMs - STALE_LOCK_MS;

  for (const p of presences) {
    if (p.userId === selfUserId) continue;
    if (p.editingShapeId !== shapeId) continue;
    if (p.lastActiveAt < staleThreshold) continue;
    return {
      canEdit: false,
      lockedBy: { userId: p.userId, userName: p.userName },
    };
  }
  return { canEdit: true, lockedBy: null };
}

// ---------------------------------------------------------------------------
// React hook — production wraps tldraw editor presence
// ---------------------------------------------------------------------------

export interface UseShapeEditLockArgs {
  shapeId: string;
  selfUserId: string;
  presences: readonly ShapePresence[];
  nowMs?: number;
}

/**
 * React hook flavor — memoized resolver. Caller is responsible for
 * passing the latest `presences` snapshot from tldraw (e.g. via
 * `useValue(editor.store.query.records('instance_presence'))`). `nowMs`
 * defaults to `Date.now()` but is injectable for tests.
 */
export function useShapeEditLock(args: UseShapeEditLockArgs): EditLockState {
  const { shapeId, selfUserId, presences, nowMs } = args;
  return useMemo(
    () =>
      resolveEditLock({
        shapeId,
        selfUserId,
        presences,
        nowMs: nowMs ?? Date.now(),
      }),
    [shapeId, selfUserId, presences, nowMs],
  );
}
