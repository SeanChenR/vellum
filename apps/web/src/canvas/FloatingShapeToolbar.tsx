/**
 * FloatingShapeToolbar — bridges the dumb `ShapeToolbar` to a tldraw
 * editor instance for shape insertion. Renders as a sibling of the
 * <Tldraw> component (NOT through `components.InFrontOfTheCanvas`) so
 * its z-index lives outside tldraw's internal stacking context and the
 * panel is never hidden by the built-in toolbar / dropdowns.
 *
 * Caller passes the editor instance captured via tldraw's `onMount`.
 *
 * Spec: canvas-editor — "Canvas toolbar exposes four custom shape
 * insertion buttons".
 */

import { createShapeId, type Editor as TldrawEditor } from "tldraw";
import { ShapeToolbar, type ShapeKind } from "./ShapeToolbar";

// Default shape sizes. Mirrors getDefaultProps in shape-utils.tsx so the
// toolbar can compute centre offsets without round-tripping through
// editor.getDefaultProps (not a public API).
const DEFAULT_SIZE: Record<ShapeKind, { w: number; h: number }> = {
  markdown: { w: 320, h: 200 },
  code: { w: 360, h: 220 },
  callout: { w: 320, h: 80 },
  "link-card": { w: 360, h: 220 },
};

export interface FloatingShapeToolbarProps {
  editor: TldrawEditor;
}

export function FloatingShapeToolbar({ editor }: FloatingShapeToolbarProps) {
  const handleInsert = (kind: ShapeKind) => {
    const center = editor.getViewportPageBounds().center;
    const size = DEFAULT_SIZE[kind];
    const id = createShapeId();
    editor.createShape({
      id,
      type: kind,
      x: center.x - size.w / 2,
      y: center.y - size.h / 2,
    });
    editor.select(id);
  };

  return (
    <div
      className="pointer-events-auto absolute bottom-24 left-1/2 z-[1000] -translate-x-1/2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ShapeToolbar onInsert={handleInsert} />
    </div>
  );
}
