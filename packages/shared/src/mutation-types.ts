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
 * createShape mutation variant. M12.2 will add sibling variants here.
 */
export const createShapeMutationSchema = z.object({
  type: z.literal("createShape"),
  payload: createShapePayloadSchema,
});

export type CreateShapeMutation = z.infer<typeof createShapeMutationSchema>;

/**
 * Discriminated union of all server-side mutations. Single source of
 * truth for the mutator's input type.
 */
export const mutationSchema = z.discriminatedUnion("type", [
  createShapeMutationSchema,
  // Future: updateShapeMutationSchema, deleteShapeMutationSchema, ...
]);

export type Mutation = z.infer<typeof mutationSchema>;

/**
 * applyMutation input — array of mutations applied together as a single
 * server-side batch (preserved as a single client-side undo entry).
 * At least one mutation is required; an empty batch is a no-op and a
 * caller bug, not a valid request.
 */
export const mutationsSchema = z.array(mutationSchema).min(1);
