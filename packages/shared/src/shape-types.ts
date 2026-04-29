/**
 * shape-types.ts — Custom shape registry for Vellum's tldraw integration.
 *
 * // Populated incrementally by add-shape-* changes; intentionally empty in add-canvas-editor-shell.
 *
 * This file is the single extension point for custom shapes. Downstream changes
 * (add-shape-markdown, add-shape-code, add-shape-callout, add-shape-link-card)
 * append to these arrays. The Editor component imports them and passes them to
 * <Tldraw shapeUtils={...} tools={...} /> — no Editor changes needed when adding shapes.
 *
 * Server-side (add-multiplayer-sync) also imports ShapeType definitions from here
 * for schema validation, which is why this lives in packages/shared rather than apps/web.
 */

import type { TLAnyShapeUtilConstructor, TLStateNodeConstructor } from "tldraw";

// Populated incrementally by add-shape-* changes; intentionally empty in add-canvas-editor-shell.
export const customShapeUtils: TLAnyShapeUtilConstructor[] = [];

// Populated incrementally by add-shape-* changes; intentionally empty in add-canvas-editor-shell.
export const customShapeTools: TLStateNodeConstructor[] = [];
