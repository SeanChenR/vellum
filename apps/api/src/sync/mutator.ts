/**
 * mutator.ts — Server tldraw Mutator (M12.1).
 *
 * Applies a server-initiated batch of mutations to an active TLSocketRoom
 * and relies on the room's broadcast pipeline to propagate the resulting
 * record changes to all connected clients.
 *
 * Public surface: `applyMutation(deps, canvasId, mutations)`. Caller
 * supplies a registry and the mutator narrows the room interface from
 * `SyncRoomLike` to a `MutatorRoom` that has the server-side `updateStore`
 * primitive (the real TLSocketRoom satisfies it; tests inject a stub).
 *
 * Spec ref: openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 * Design ref: "Mutation 介面：accept 陣列、保留 batch 語意" +
 *             "TLSocketRoom 內部 API 選擇 — 由 spike 決定，紀錄到 ADR"
 */

import { mutationsSchema, type Mutation } from "@vellum/shared/mutation-types";
import type { RoomRegistry, SyncRoomLike } from "./room";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplyMutationDeps {
  registry: RoomRegistry<SyncRoomLike>;
}

export type MutationResult =
  | { ok: true; appliedCount: number }
  | { ok: false; errorKey: MutationErrorKey };

export type MutationErrorKey =
  | "errors.devMutate.invalidPayload"
  | "errors.devMutate.canvasNotInActiveRoom"
  | "errors.devMutate.mutationFailed";

/**
 * Minimal store contract that updateStore's updater fn receives. We only
 * use `put` in M12.1; broader access (`get`, `delete`) lands in M12.2.
 */
interface MutatorStore {
  put(record: unknown): void;
}

/**
 * Subset of TLSocketRoom we need. The real room satisfies this; the test
 * stub provides exactly these methods.
 */
interface MutatorRoom {
  updateStore(updater: (store: MutatorStore) => void | Promise<void>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Apply a batch of mutations to the active sync room for `canvasId`.
 *
 * Validation: Zod-checks the entire mutation array up front. Any schema
 * failure short-circuits with `errors.devMutate.invalidPayload` and the
 * room is never touched.
 *
 * Room lookup: the registry returns `undefined` when no client is
 * connected — we don't lazy-hydrate at the mutator layer (lazy hydrate
 * is M12.2's concern), so this resolves to
 * `errors.devMutate.canvasNotInActiveRoom`.
 *
 * Batch: a single `updateStore(...)` call scopes all mutations to one
 * server-side transaction. The resulting broadcast represents one logical
 * change, which preserves single-undo semantics on the client.
 *
 * Error containment: any unexpected throw from inside `updateStore` is
 * caught and returned as `errors.devMutate.mutationFailed`. The mutator
 * never lets exceptions escape into the sync server's event loop.
 */
export async function applyMutation(
  deps: ApplyMutationDeps,
  canvasId: string,
  mutations: Mutation[],
): Promise<MutationResult> {
  // 1. Validate input shape (Zod).
  const parsed = mutationsSchema.safeParse(mutations);
  if (!parsed.success) {
    return { ok: false, errorKey: "errors.devMutate.invalidPayload" };
  }

  // 2. Look up the active room. M12.1 deliberately does not lazy-hydrate.
  const room = deps.registry.getRoom(canvasId) as unknown as MutatorRoom | undefined;
  if (!room) {
    return { ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" };
  }

  // 3. Apply all mutations in a single batch.
  try {
    await commitBatch(room, parsed.data);
  } catch {
    // Per design "錯誤合約與 i18n": no exception escapes to the sync server.
    return { ok: false, errorKey: "errors.devMutate.mutationFailed" };
  }

  return { ok: true, appliedCount: parsed.data.length };
}

// ---------------------------------------------------------------------------
// Internal: commitBatch
// ---------------------------------------------------------------------------

/**
 * Encapsulates the TLSocketRoom server-side write entry point. Today
 * this is `updateStore` — the spike's first-choice candidate per design
 * "TLSocketRoom 內部 API 選擇". If a future tldraw-sync upgrade deprecates
 * this surface, this is the single function to swap.
 *
 * All mutations in `ops` are committed inside one updater invocation so
 * the resulting broadcast is a single batch.
 */
async function commitBatch(room: MutatorRoom, ops: Mutation[]): Promise<void> {
  await room.updateStore((store) => {
    for (const op of ops) {
      applyOne(store, op);
    }
  });
}

function applyOne(store: MutatorStore, op: Mutation): void {
  switch (op.type) {
    case "createShape": {
      // Construct a tldraw shape record. The integration test (Section 8)
      // exercises this against a real TLSocketRoom; the schema/defaults
      // here intentionally mirror tldraw's shape record shape.
      const record = {
        id: op.payload.id,
        typeName: "shape",
        type: op.payload.type,
        x: op.payload.x,
        y: op.payload.y,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        parentId: "page:page",
        index: "a1",
        meta: {},
        props: op.payload.props ?? {},
      };
      store.put(record);
      return;
    }
  }
}
