/**
 * tool-registry.ts — typed lookup table for the agent tool surface
 * (Phase 2, M12.2).
 *
 * Every tool the agent runtime (M13.1) calls flows through this
 * registry. Six write tools route through `applyMutation` (so batch
 * undo semantics from M12.1 are preserved); five read tools route
 * through the corresponding `mutator-readers` function.
 *
 * The TypeScript record `Record<ToolName, ToolEntry>` is exhaustive —
 * if a future change adds a new tool name without registering an entry,
 * compilation breaks.
 *
 * Spec ref: openspec/changes/add-full-tool-surface/specs/server-mutation-bridge/spec.md
 *   "Tool registry enumerates the full agent tool surface"
 */

import type { ZodTypeAny } from "zod";
import type {
  ConnectShapesPayload,
  CreateShapePayload,
  DeleteShapePayload,
  GroupShapesPayload,
  UngroupShapePayload,
  UpdateShapePayload,
} from "@vellum/shared/mutation-types";
import {
  connectShapesPayloadSchema,
  createShapePayloadSchema,
  deleteShapePayloadSchema,
  groupShapesPayloadSchema,
  ungroupShapePayloadSchema,
  updateShapePayloadSchema,
} from "@vellum/shared/mutation-types";
import type { ToolKind, ToolName } from "@vellum/shared/tool-types";
import { z } from "zod";
import { applyMutation, type ApplyMutationDeps, type MutationResult } from "./mutator";
import {
  getCanvasBounds,
  getShape,
  getViewport,
  listShapesInSelection,
  listShapesInViewport,
  type Bounds,
  type MutatorReadersDeps,
  type ReaderResult,
  type ShapeSummary,
  type Viewport,
} from "./mutator-readers";

// ---------------------------------------------------------------------------
// Public deps + entry types
// ---------------------------------------------------------------------------

/**
 * Combined deps used by the registry. Includes all mutator + reader
 * deps in one bag so the agent runtime can build a single deps object
 * and dispatch to any tool by name.
 *
 * `applyMutation` is overridable for tests so a fake mutator can be
 * injected without touching the registry contents.
 */
export interface ToolRegistryDeps extends ApplyMutationDeps, MutatorReadersDeps {
  /** Optional override; production wiring uses the real `applyMutation`. */
  applyMutation?: typeof applyMutation;
}

interface BaseEntry<Name extends ToolName, Kind extends ToolKind, Payload, Result> {
  name: Name;
  kind: Kind;
  schema: ZodTypeAny;
  execute(deps: ToolRegistryDeps, canvasId: string, input: Payload): Promise<Result>;
}

type WriteEntry<Name extends ToolName, Payload> = BaseEntry<Name, "write", Payload, MutationResult>;

type ReadEntry<Name extends ToolName, Payload, Data> = BaseEntry<
  Name,
  "read",
  Payload,
  ReaderResult<Data>
>;

export type ToolEntry =
  | WriteEntry<"createShape", CreateShapePayload>
  | WriteEntry<"updateShape", UpdateShapePayload>
  | WriteEntry<"deleteShape", DeleteShapePayload>
  | WriteEntry<"groupShapes", GroupShapesPayload>
  | WriteEntry<"ungroupShape", UngroupShapePayload>
  | WriteEntry<"connectShapes", ConnectShapesPayload>
  | ReadEntry<"listShapesInViewport", Bounds, ShapeSummary[]>
  | ReadEntry<"listShapesInSelection", { sessionId: string }, ShapeSummary[]>
  | ReadEntry<"getShape", { shapeId: string }, ShapeSummary | null>
  | ReadEntry<"getCanvasBounds", Record<string, never>, Bounds | null>
  | ReadEntry<"getViewport", { sessionId: string }, Viewport | null>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const noPayloadSchema = z.object({}).strict();
const sessionIdSchema = z.object({ sessionId: z.string().min(1) });
const shapeIdSchema = z.object({ shapeId: z.string().min(1) });
const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

function writeExec<Name extends ToolName, Payload>(
  type: Name,
): WriteEntry<Name, Payload>["execute"] {
  return async (deps, canvasId, input) => {
    const apply = deps.applyMutation ?? applyMutation;
    return apply(deps, canvasId, [{ type, payload: input } as never]);
  };
}

export const toolRegistry: Record<ToolName, ToolEntry> = {
  createShape: {
    name: "createShape",
    kind: "write",
    schema: createShapePayloadSchema,
    execute: writeExec<"createShape", CreateShapePayload>("createShape"),
  },
  updateShape: {
    name: "updateShape",
    kind: "write",
    schema: updateShapePayloadSchema,
    execute: writeExec<"updateShape", UpdateShapePayload>("updateShape"),
  },
  deleteShape: {
    name: "deleteShape",
    kind: "write",
    schema: deleteShapePayloadSchema,
    execute: writeExec<"deleteShape", DeleteShapePayload>("deleteShape"),
  },
  groupShapes: {
    name: "groupShapes",
    kind: "write",
    schema: groupShapesPayloadSchema,
    execute: writeExec<"groupShapes", GroupShapesPayload>("groupShapes"),
  },
  ungroupShape: {
    name: "ungroupShape",
    kind: "write",
    schema: ungroupShapePayloadSchema,
    execute: writeExec<"ungroupShape", UngroupShapePayload>("ungroupShape"),
  },
  connectShapes: {
    name: "connectShapes",
    kind: "write",
    schema: connectShapesPayloadSchema,
    execute: writeExec<"connectShapes", ConnectShapesPayload>("connectShapes"),
  },
  listShapesInViewport: {
    name: "listShapesInViewport",
    kind: "read",
    schema: viewportSchema,
    execute: async (deps, canvasId, viewport) => listShapesInViewport(deps, canvasId, viewport),
  },
  listShapesInSelection: {
    name: "listShapesInSelection",
    kind: "read",
    schema: sessionIdSchema,
    execute: async (deps, canvasId, input) =>
      listShapesInSelection(deps, canvasId, input.sessionId),
  },
  getShape: {
    name: "getShape",
    kind: "read",
    schema: shapeIdSchema,
    execute: async (deps, canvasId, input) => getShape(deps, canvasId, input.shapeId),
  },
  getCanvasBounds: {
    name: "getCanvasBounds",
    kind: "read",
    schema: noPayloadSchema,
    execute: async (deps, canvasId) => getCanvasBounds(deps, canvasId),
  },
  getViewport: {
    name: "getViewport",
    kind: "read",
    schema: sessionIdSchema,
    execute: async (deps, canvasId, input) => getViewport(deps, canvasId, input.sessionId),
  },
};
