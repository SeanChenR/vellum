/**
 * VellumToolbar — overrides tldraw's bottom toolbar so our four custom
 * shape buttons sit inline with the default tools (select / hand / draw
 * / etc.). This replaces the previous floating overlay which collided
 * with tldraw's own toolbar.
 *
 * Mounting: register as `Toolbar` in the tldraw `components` prop. The
 * `<DefaultToolbar>` wrapper handles overflow + dropdown for narrow
 * viewports; we render the default tool set first, then append our
 * shape-insertion buttons.
 *
 * Spec: canvas-editor — "Canvas toolbar exposes four custom shape
 * insertion buttons".
 */

import {
  DefaultToolbar,
  DefaultToolbarContent,
  createShapeId,
  useEditor,
  useReadonly,
} from "tldraw";
import { Code2, FileText, Link2, MessageSquareWarning, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ShapeKind } from "./ShapeToolbar";

interface ToolbarEntry {
  kind: ShapeKind;
  tooltipKey: string;
  icon: LucideIcon;
  defaultSize: { w: number; h: number };
}

const ENTRIES: readonly ToolbarEntry[] = [
  {
    kind: "markdown",
    tooltipKey: "shapes.markdown.toolbarTooltip",
    icon: FileText,
    defaultSize: { w: 320, h: 200 },
  },
  {
    kind: "code",
    tooltipKey: "shapes.code.toolbarTooltip",
    icon: Code2,
    defaultSize: { w: 360, h: 220 },
  },
  {
    kind: "callout",
    tooltipKey: "shapes.callout.toolbarTooltip",
    icon: MessageSquareWarning,
    defaultSize: { w: 320, h: 80 },
  },
  {
    kind: "link-card",
    tooltipKey: "shapes.linkCard.toolbarTooltip",
    icon: Link2,
    defaultSize: { w: 360, h: 220 },
  },
];

export function VellumToolbar() {
  const { t } = useTranslation();
  const editor = useEditor();
  const isReadonly = useReadonly();

  const handleInsert = (entry: ToolbarEntry) => {
    const center = editor.getViewportPageBounds().center;
    const id = createShapeId();
    editor.createShape({
      id,
      type: entry.kind,
      x: center.x - entry.defaultSize.w / 2,
      y: center.y - entry.defaultSize.h / 2,
    });
    editor.select(id);
  };

  // maxSizePx overrides DefaultToolbar's overflow-collapse so all the
  // built-in tools + our four custom shape buttons stay visible inline
  // on the same horizontal bar (no `^` dropdown).
  // Readonly viewers can't insert shapes — drop the 4 custom buttons.
  if (isReadonly) {
    return (
      <DefaultToolbar maxSizePx={9999} maxItems={50}>
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  }

  return (
    <DefaultToolbar maxSizePx={9999} maxItems={50}>
      <DefaultToolbarContent />
      {ENTRIES.map((entry) => {
        const Icon = entry.icon;
        const tooltip = t(entry.tooltipKey);
        return (
          <button
            key={entry.kind}
            type="button"
            data-shape-kind={entry.kind}
            aria-label={tooltip}
            title={tooltip}
            onPointerDown={(e) => {
              // Stop tldraw's tool-routing from swallowing the click.
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleInsert(entry);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded text-text-primary hover:bg-warm-50"
          >
            <Icon className="h-5 w-5" aria-hidden />
          </button>
        );
      })}
    </DefaultToolbar>
  );
}
