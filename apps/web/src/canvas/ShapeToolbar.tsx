/**
 * ShapeToolbar — four custom shape insertion buttons.
 *
 * Renders 4 buttons (Markdown / Code / Callout / Link card) in fixed
 * order with lucide icons and localized tooltips. Pure props-driven
 * component — the wrapper that owns tldraw's editor instance is
 * responsible for constructing the actual shapes inside `onInsert`.
 *
 * Spec: canvas-editor — "Canvas toolbar exposes four custom shape
 * insertion buttons".
 */

import { Code2, FileText, Link2, MessageSquareWarning, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ShapeKind = "markdown" | "code" | "callout" | "link-card";

export interface ShapeToolbarProps {
  onInsert: (kind: ShapeKind) => void;
}

interface ToolbarEntry {
  kind: ShapeKind;
  /** i18n key path under shapes.<name>.toolbarTooltip */
  tooltipKey: string;
  icon: LucideIcon;
}

// Order matches the spec: Markdown, Code, Callout, Link card.
const ENTRIES: readonly ToolbarEntry[] = [
  { kind: "markdown", tooltipKey: "shapes.markdown.toolbarTooltip", icon: FileText },
  { kind: "code", tooltipKey: "shapes.code.toolbarTooltip", icon: Code2 },
  { kind: "callout", tooltipKey: "shapes.callout.toolbarTooltip", icon: MessageSquareWarning },
  { kind: "link-card", tooltipKey: "shapes.linkCard.toolbarTooltip", icon: Link2 },
];

export function ShapeToolbar({ onInsert }: ShapeToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="shape-toolbar"
      className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-sm"
    >
      {ENTRIES.map(({ kind, tooltipKey, icon: Icon }) => {
        const tooltip = t(tooltipKey);
        return (
          <button
            key={kind}
            type="button"
            data-shape-kind={kind}
            aria-label={tooltip}
            title={tooltip}
            onClick={() => onInsert(kind)}
            className="rounded-md p-2 text-text-primary hover:bg-warm-50"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
