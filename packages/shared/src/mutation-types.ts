/**
 * mutation-types.ts — Discriminated union for server-side mutations applied
 * via the Server tldraw Mutator (apps/api/src/sync/mutator.ts).
 *
 * Lives in packages/shared so both the server (mutator + dev endpoint +
 * tests) and any future client-side helpers reference the same shape.
 *
 * Design ref: "Mutation 介面：accept 陣列、保留 batch 語意" in
 * openspec/changes/add-server-tldraw-mutator/design.md.
 *
 * M12.1 only wires the createShape variant; M12.2 adds updateShape /
 * deleteShape / groupShapes / connectShapes by extending this union — the
 * shape is intentionally extensible without breaking the applyMutation
 * caller signature.
 */

import { z } from "zod";

/**
 * createShape payload — minimal record fields tldraw needs to insert a
 * new shape into a sync room's store. `props` is opaque at this layer
 * because tldraw shape props are shape-type-specific; the mutator and
 * the room together validate at apply time.
 */
export const createShapePayloadSchema = z.object({
  id: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
  type: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export type CreateShapePayload = z.infer<typeof createShapePayloadSchema>;

/**
 * createShape mutation variant.
 */
export const createShapeMutationSchema = z.object({
  type: z.literal("createShape"),
  payload: createShapePayloadSchema,
});

export type CreateShapeMutation = z.infer<typeof createShapeMutationSchema>;

// ---------------------------------------------------------------------------
// updateShape — M12.2
// ---------------------------------------------------------------------------

/**
 * updateShape payload — partial merge onto an existing shape. `partial`
 * is a deep-merge directive: top-level fields shallow-replace; `props`
 * is shallow-merged with the existing record's props.
 */
export const updateShapePartialSchema = z
  .object({
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    rotation: z.number().finite().optional(),
    parentId: z.string().min(1).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    props: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type UpdateShapePartial = z.infer<typeof updateShapePartialSchema>;

export const updateShapePayloadSchema = z.object({
  id: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
  partial: updateShapePartialSchema,
});

export type UpdateShapePayload = z.infer<typeof updateShapePayloadSchema>;

export const updateShapeMutationSchema = z.object({
  type: z.literal("updateShape"),
  payload: updateShapePayloadSchema,
});

export type UpdateShapeMutation = z.infer<typeof updateShapeMutationSchema>;

// ---------------------------------------------------------------------------
// deleteShape — M12.2
// ---------------------------------------------------------------------------

export const deleteShapePayloadSchema = z.object({
  id: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
});

export type DeleteShapePayload = z.infer<typeof deleteShapePayloadSchema>;

export const deleteShapeMutationSchema = z.object({
  type: z.literal("deleteShape"),
  payload: deleteShapePayloadSchema,
});

export type DeleteShapeMutation = z.infer<typeof deleteShapeMutationSchema>;

// ---------------------------------------------------------------------------
// groupShapes — M12.2
// ---------------------------------------------------------------------------

export const groupShapesPayloadSchema = z.object({
  shapeIds: z.array(z.string().regex(/^shape:[A-Za-z0-9_-]+$/)).min(1),
  groupId: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
});

export type GroupShapesPayload = z.infer<typeof groupShapesPayloadSchema>;

export const groupShapesMutationSchema = z.object({
  type: z.literal("groupShapes"),
  payload: groupShapesPayloadSchema,
});

export type GroupShapesMutation = z.infer<typeof groupShapesMutationSchema>;

// ---------------------------------------------------------------------------
// ungroupShape — M12.2
// ---------------------------------------------------------------------------

export const ungroupShapePayloadSchema = z.object({
  groupId: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
});

export type UngroupShapePayload = z.infer<typeof ungroupShapePayloadSchema>;

export const ungroupShapeMutationSchema = z.object({
  type: z.literal("ungroupShape"),
  payload: ungroupShapePayloadSchema,
});

export type UngroupShapeMutation = z.infer<typeof ungroupShapeMutationSchema>;

// ---------------------------------------------------------------------------
// connectShapes — M12.2
// ---------------------------------------------------------------------------

export const connectShapesPayloadSchema = z.object({
  fromId: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
  toId: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
  arrowId: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
  label: z.string().max(200).optional(),
});

export type ConnectShapesPayload = z.infer<typeof connectShapesPayloadSchema>;

export const connectShapesMutationSchema = z.object({
  type: z.literal("connectShapes"),
  payload: connectShapesPayloadSchema,
});

export type ConnectShapesMutation = z.infer<typeof connectShapesMutationSchema>;

/**
 * Discriminated union of all server-side mutations. Single source of
 * truth for the mutator's input type. Adding variants here automatically
 * widens `Mutation` for callers without breaking existing usage.
 */
export const mutationSchema = z.discriminatedUnion("type", [
  createShapeMutationSchema,
  updateShapeMutationSchema,
  deleteShapeMutationSchema,
  groupShapesMutationSchema,
  ungroupShapeMutationSchema,
  connectShapesMutationSchema,
]);

export type Mutation = z.infer<typeof mutationSchema>;

/**
 * applyMutation input — array of mutations applied together as a single
 * server-side batch (preserved as a single client-side undo entry).
 * At least one mutation is required; an empty batch is a no-op and a
 * caller bug, not a valid request.
 */
export const mutationsSchema = z.array(mutationSchema).min(1);
