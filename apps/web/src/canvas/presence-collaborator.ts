/**
 * presence-collaborator.ts — maps TLInstancePresence-shape records (the
 * thing tldraw sync broadcasts) into the TopBar-facing CollaboratorPresence
 * shape.
 *
 * Spec ref: openspec/specs/ai-side-panel/spec.md
 *   "Cursor AI Badge surfaces aiActive presence flag"
 *
 * Why a separate helper: presence records carry tldraw's full state
 * (cursor / camera / selectedShapeIds / etc.); the TopBar avatar list
 * needs only userId / displayName / image / aiActive. Centralising the
 * extraction keeps the read of `meta.aiActive` consistent and defensive
 * (boolean-only — a stringly "true" remains false).
 */

import type { CollaboratorPresence } from "./CollaboratorAvatars";

/**
 * Narrow subset of `TLInstancePresence` we depend on. Avoids pulling
 * `@tldraw/tlschema` into apps/web's direct dependency surface.
 */
export interface SyncPresenceRecord {
  id: string;
  typeName: "instance_presence";
  userId: string;
  userName: string;
  meta?: Record<string, unknown>;
}

export function mapPresenceToCollaborator(
  record: SyncPresenceRecord,
  image: string | null,
): CollaboratorPresence {
  const rawFlag = record.meta?.["aiActive"];
  return {
    userId: record.userId,
    name: record.userName,
    image,
    aiActive: rawFlag === true,
  };
}
