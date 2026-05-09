/**
 * agent-digest.ts — shared zod schema + types for the canvas digest the
 * agent runtime produces at run start.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/canvas-digest/spec.md
 *     "Digest header has fixed lightweight schema"
 *
 * The schema lives in packages/shared so the M13 server (apps/api/src/
 * agent/digest.ts) and any future client consumer (M14 Side Panel
 * preview) reference the same shape.
 */

import { z } from "zod";

const boundsSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite(),
    h: z.number().finite(),
  })
  .strict();

export const shapeRefSchema = z
  .object({
    id: z.string().regex(/^shape:[A-Za-z0-9_-]+$/),
    type: z.string().min(1),
  })
  .strict();

export const canvasDigestSchema = z
  .object({
    canvasId: z.string().min(1),
    title: z.string(),
    viewport: boundsSchema,
    selection: z.array(shapeRefSchema),
    shapeCounts: z.record(z.string(), z.number().int().nonnegative()),
    bounds: boundsSchema,
  })
  .strict();

export type CanvasDigest = z.infer<typeof canvasDigestSchema>;
export type ShapeRef = z.infer<typeof shapeRefSchema>;
export type DigestBounds = z.infer<typeof boundsSchema>;
