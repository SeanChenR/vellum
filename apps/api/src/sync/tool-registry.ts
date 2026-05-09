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
  /**
   * LLM-facing description. Forwarded by the agent runtime
   * (apps/api/src/agent/runtime.ts:buildToolDefs) into the provider
   * tool schema. Tool descriptions are how the model decides whether
   * a tool is the right fit AND how to populate every required arg —
   * empty / vague descriptions cause OpenAI strict mode to omit
   * optional fields entirely (e.g. createShape's `props`), which
   * cascades into mutator validation failures.
   */
  description: string;
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

/**
 * createShape per-shape-type prop guidance. Threaded into the tool
 * description so the LLM knows what `props` keys each `type` needs.
 * Match `apps/api/src/sync/shape-schemas.ts`.
 */
const CREATE_SHAPE_DESCRIPTION = [
  "Create a new shape on the canvas.",
  "",
  "REQUIRED arguments: id (e.g. 'shape:my-note-1', kebab-case after the 'shape:' prefix), type, x, y, props.",
  "",
  "The `props` object is REQUIRED and its keys depend on `type`:",
  "  - type='markdown': props={ content: string, w: number>0, h: number>0 }",
  "  - type='code':     props={ source: string, language: 'javascript'|'typescript'|'python'|'go'|'swift'|'rust'|'html'|'css'|'sql'|'bash'|'markdown'|'json', w: number>0, h: number>0 }",
  "  - type='callout':  props={ variant: 'info'|'warning'|'danger', body: string, w: number>0, h: number>0 }",
  "  - type='link-card': props={ url: string, state: 'pending'|'success'|'error', metadata: object|null, fetchedAt: string|null, w: number>0, h: number>0 }",
  "",
  "Sensible defaults: w=320, h=180 for markdown / code / callout; w=320, h=120 for link-card. Place new shapes at x=100, y=100 unless context suggests otherwise.",
].join("\n");

export const toolRegistry: Record<ToolName, ToolEntry> = {
  createShape: {
    name: "createShape",
    kind: "write",
    description: CREATE_SHAPE_DESCRIPTION,
    schema: createShapePayloadSchema,
    execute: writeExec<"createShape", CreateShapePayload>("createShape"),
  },
  updateShape: {
    name: "updateShape",
    kind: "write",
    description:
      "Update properties of an existing shape by id. Provide only the keys you want to change inside `patch`; unspecified keys keep their current value. The shape's `type` cannot change. Use `getShape` first if unsure of current props.",
    schema: updateShapePayloadSchema,
    execute: writeExec<"updateShape", UpdateShapePayload>("updateShape"),
  },
  deleteShape: {
    name: "deleteShape",
    kind: "write",
    description:
      "Delete a shape from the canvas by id. The user can undo with Cmd+Z. Use only when the user explicitly asks to remove a shape.",
    schema: deleteShapePayloadSchema,
    execute: writeExec<"deleteShape", DeleteShapePayload>("deleteShape"),
  },
  groupShapes: {
    name: "groupShapes",
    kind: "write",
    description:
      "Group two or more existing shapes so the user can move/scale them together. Provide the array of shape ids to group; all ids must exist on the canvas.",
    schema: groupShapesPayloadSchema,
    execute: writeExec<"groupShapes", GroupShapesPayload>("groupShapes"),
  },
  ungroupShape: {
    name: "ungroupShape",
    kind: "write",
    description:
      "Un-group a previously grouped set of shapes by the group's id. The constituent shapes remain on the canvas as individual records.",
    schema: ungroupShapePayloadSchema,
    execute: writeExec<"ungroupShape", UngroupShapePayload>("ungroupShape"),
  },
  connectShapes: {
    name: "connectShapes",
    kind: "write",
    description:
      "Draw a tldraw arrow shape connecting two existing shapes. Both `fromId` and `toId` must already exist on the canvas. Use to express relationships between markdown / code / callout shapes.",
    schema: connectShapesPayloadSchema,
    execute: writeExec<"connectShapes", ConnectShapesPayload>("connectShapes"),
  },
  listShapesInViewport: {
    name: "listShapesInViewport",
    kind: "read",
    description:
      "List shapes intersecting a given viewport rectangle (world coordinates). Use this to discover what is currently visible to the user before deciding where to place new shapes.",
    schema: viewportSchema,
    execute: async (deps, canvasId, viewport) => listShapesInViewport(deps, canvasId, viewport),
  },
  listShapesInSelection: {
    name: "listShapesInSelection",
    kind: "read",
    description:
      "List shapes the user has currently selected (per their tldraw session). Use this when the user refers to 'this shape' / 'these shapes' so the agent acts on the correct ids.",
    schema: sessionIdSchema,
    execute: async (deps, canvasId, input) =>
      listShapesInSelection(deps, canvasId, input.sessionId),
  },
  getShape: {
    name: "getShape",
    kind: "read",
    description:
      "Read the current props and geometry of a single shape by id. Returns null when the shape does not exist. Use before `updateShape` to inspect what's there.",
    schema: shapeIdSchema,
    execute: async (deps, canvasId, input) => getShape(deps, canvasId, input.shapeId),
  },
  getCanvasBounds: {
    name: "getCanvasBounds",
    kind: "read",
    description:
      "Get the bounding box (x, y, w, h) of all shapes on the canvas. Returns null when the canvas is empty. Use to decide where to place new shapes without overlapping existing ones.",
    schema: noPayloadSchema,
    execute: async (deps, canvasId) => getCanvasBounds(deps, canvasId),
  },
  getViewport: {
    name: "getViewport",
    kind: "read",
    description:
      "Get the user's current viewport rectangle (what they're looking at, in world coordinates). Use to place new shapes near where the user is focused.",
    schema: sessionIdSchema,
    execute: async (deps, canvasId, input) => getViewport(deps, canvasId, input.sessionId),
  },
};
