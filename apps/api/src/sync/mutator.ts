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
import { transformGeoPartialProps, withGeoCreateDefaults } from "./geo-defaults";

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
  | "errors.devMutate.mutationFailed"
  | "errors.fullToolSurface.shapeNotFound"
  | "errors.fullToolSurface.groupNotFound"
  | "errors.fullToolSurface.invalidViewport"
  | "errors.fullToolSurface.sessionNotFound"
  | "errors.listCanvases.queryFailed"
  | "errors.listCanvases.depsMissing";

/**
 * Subset of tldraw's `RoomStoreMethods` that the mutator needs. Real
 * TLSocketRoom satisfies this; tests inject a stub backed by a Map.
 *
 * `get` returns `null` for missing records (tldraw's contract); we throw
 * `Error("errors.fullToolSurface.shapeNotFound")` on the spot in the
 * caller so `applyMutation`'s catch can map back to the structured
 * errorKey result.
 */
interface MutatorStore {
  put(record: ShapeRecord): void;
  get(id: string): ShapeRecord | null;
  delete(idOrRecord: string | ShapeRecord): void;
  getAll(): ShapeRecord[];
}

/**
 * Best-effort shape of a tldraw record we round-trip through the
 * mutator. `props` and `meta` are opaque at this layer — shape-type-
 * specific schema validation runs inside tldraw when the record is put.
 */
interface ShapeRecord {
  id: string;
  typeName: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  isLocked?: boolean;
  opacity?: number;
  parentId: string;
  index: string;
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
  [key: string]: unknown;
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
  } catch (err) {
    // Mutator helpers throw `Error(<errorKey>)` for known failure modes
    // (shape not found, group not found, etc.). Pluck a known errorKey
    // off `err.message` if present; otherwise fall back to generic
    // mutationFailed so no exception escapes to the sync server.
    return { ok: false, errorKey: extractErrorKey(err) };
  }

  return { ok: true, appliedCount: parsed.data.length };
}

const KNOWN_ERROR_KEYS = new Set<MutationErrorKey>([
  "errors.fullToolSurface.shapeNotFound",
  "errors.fullToolSurface.groupNotFound",
  "errors.fullToolSurface.invalidViewport",
  "errors.fullToolSurface.sessionNotFound",
]);

function extractErrorKey(err: unknown): MutationErrorKey {
  if (err instanceof Error && (KNOWN_ERROR_KEYS as Set<string>).has(err.message)) {
    return err.message as MutationErrorKey;
  }
  return "errors.devMutate.mutationFailed";
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
      // tldraw's `geo` shape needs a full prop set to pass record validation;
      // the LLM agent surface only ships a slim subset (geo / color / fill /
      // dash / size / text / w / h), so we backfill the rest here. Non-geo
      // shape types (markdown / code / callout / link-card) are validated by
      // vellumStoreSchema directly and pass through untouched.
      const props =
        op.payload.type === "geo"
          ? withGeoCreateDefaults(op.payload.props ?? {})
          : (op.payload.props ?? {});
      const record: ShapeRecord = {
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
        props,
      };
      store.put(record);
      return;
    }

    case "updateShape": {
      const existing = store.get(op.payload.id);
      if (!existing) throw new Error("errors.fullToolSurface.shapeNotFound");
      const partial = op.payload.partial;
      // For geo updates, convert plain `text` to richText before merge —
      // we never overwrite other props that the existing record already has.
      const normalisedPartialProps =
        partial.props && existing.type === "geo"
          ? transformGeoPartialProps(partial.props)
          : partial.props;
      const merged: ShapeRecord = {
        ...existing,
        ...(partial.x !== undefined ? { x: partial.x } : {}),
        ...(partial.y !== undefined ? { y: partial.y } : {}),
        ...(partial.rotation !== undefined ? { rotation: partial.rotation } : {}),
        ...(partial.parentId !== undefined ? { parentId: partial.parentId } : {}),
        meta: partial.meta ? { ...existing.meta, ...partial.meta } : existing.meta,
        props: normalisedPartialProps
          ? { ...existing.props, ...normalisedPartialProps }
          : existing.props,
      };
      store.put(merged);
      return;
    }

    case "deleteShape": {
      const existing = store.get(op.payload.id);
      if (!existing) throw new Error("errors.fullToolSurface.shapeNotFound");
      store.delete(op.payload.id);
      return;
    }

    case "groupShapes": {
      // Verify every child exists before mutating anything.
      const children: ShapeRecord[] = [];
      for (const id of op.payload.shapeIds) {
        const r = store.get(id);
        if (!r) throw new Error("errors.fullToolSurface.shapeNotFound");
        children.push(r);
      }
      // Group inherits parentId from the first child (per design).
      const groupParentId = children[0]!.parentId;
      const groupRecord: ShapeRecord = {
        id: op.payload.groupId,
        typeName: "shape",
        type: "group",
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        parentId: groupParentId,
        index: "a1",
        meta: {},
        props: {},
      };
      store.put(groupRecord);
      // Reparent children.
      for (const child of children) {
        store.put({ ...child, parentId: op.payload.groupId });
      }
      return;
    }

    case "ungroupShape": {
      const group = store.get(op.payload.groupId);
      if (!group || group.type !== "group") {
        throw new Error("errors.fullToolSurface.groupNotFound");
      }
      const fallbackParent = group.parentId;
      // Re-parent every child of this group.
      for (const r of store.getAll()) {
        if (r.parentId === op.payload.groupId) {
          store.put({ ...r, parentId: fallbackParent });
        }
      }
      store.delete(op.payload.groupId);
      return;
    }

    case "connectShapes": {
      const from = store.get(op.payload.fromId);
      const to = store.get(op.payload.toId);
      if (!from || !to) throw new Error("errors.fullToolSurface.shapeNotFound");

      // tldraw 4.x arrow shape requires a fully-populated props bag —
      // any missing field fails schema validation. Defaults below mirror
      // tldraw's own `arrowShape.getDefaultProps()`.
      const labelText = op.payload.label ?? "";
      const richText = labelText
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: labelText }],
              },
            ],
          }
        : { type: "doc", content: [{ type: "paragraph" }] };
      const arrowRecord: ShapeRecord = {
        id: op.payload.arrowId,
        typeName: "shape",
        type: "arrow",
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        parentId: "page:page",
        index: "a1",
        meta: {},
        props: {
          kind: "arc",
          labelColor: "black",
          color: "black",
          fill: "none",
          dash: "draw",
          size: "m",
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          font: "draw",
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
          bend: 0,
          richText,
          labelPosition: 0.5,
          scale: 1,
          elbowMidPoint: 0.5,
        },
      };
      store.put(arrowRecord);

      const baseId = op.payload.arrowId.replace(/^shape:/, "");
      const bindingProps = (terminal: "start" | "end") => ({
        terminal,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
        snap: "none" as const,
      });
      // Bindings are a distinct record type (no x/y/rotation/parentId
      // /index). Cast through `unknown → ShapeRecord` so the loose
      // typing tolerates the narrower binding shape.
      const startBinding = {
        id: `binding:${baseId}:start`,
        typeName: "binding",
        type: "arrow",
        fromId: op.payload.arrowId,
        toId: op.payload.fromId,
        props: bindingProps("start"),
        meta: {},
      } as unknown as ShapeRecord;
      const endBinding = {
        id: `binding:${baseId}:end`,
        typeName: "binding",
        type: "arrow",
        fromId: op.payload.arrowId,
        toId: op.payload.toId,
        props: bindingProps("end"),
        meta: {},
      } as unknown as ShapeRecord;
      store.put(startBinding);
      store.put(endBinding);
      return;
    }
  }
}
