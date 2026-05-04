/**
 * markdown-shape — view + edit dialog components for the Markdown shape.
 *
 * The view renders sanitized HTML produced by `parseMarkdown`. Double-
 * clicking an unlocked view triggers `onRequestEdit`; the surrounding
 * tldraw ShapeUtil owns the open/close state and the editor.updateShape
 * call. When `locked=true`, the view shows a localized lock badge
 * (`shapes.common.lockedBy` interpolated with the locker's name) and
 * absorbs the double-click without invoking the callback.
 *
 * The dialog component manages its own textarea state. `onSubmit(content)`
 * is called when the user clicks Save; `onCancel` is called when the user
 * presses Esc, clicks Cancel, or clicks the backdrop.
 *
 * Spec: canvas-shapes — "Markdown shape opens a dialog editor on double-
 * click" + multiplayer-sync shape edit lock.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { parseMarkdown } from "./markdown-parser";

// ---------------------------------------------------------------------------
// View — props-driven, dumb component
// ---------------------------------------------------------------------------

export interface MarkdownShapeLockedBy {
  userId: string;
  userName: string;
}

export interface MarkdownShapeViewProps {
  content: string;
  locked: boolean;
  lockedBy: MarkdownShapeLockedBy | null;
  onRequestEdit: () => void;
}

export function MarkdownShapeView({
  content,
  locked,
  lockedBy,
  onRequestEdit,
}: MarkdownShapeViewProps) {
  const { t } = useTranslation();
  const html = parseMarkdown(content);

  const handleDoubleClick = () => {
    if (locked) return;
    onRequestEdit();
  };

  return (
    <div
      data-testid="markdown-shape-root"
      onDoubleClick={handleDoubleClick}
      className="relative h-full w-full overflow-auto rounded-lg border border-warm-200 bg-white p-4"
    >
      {locked && lockedBy && (
        <span
          data-testid="markdown-shape-lock-badge"
          className="absolute right-2 top-2 rounded-md bg-ink-navy/85 px-2 py-1 text-xs font-medium text-white"
        >
          {t("shapes.common.lockedBy", { name: lockedBy.userName })}
        </span>
      )}
      <div
        className="prose prose-sm max-w-none"
        // Rendered HTML is already sanitized by `parseMarkdown` (DOMPurify).
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit dialog — controlled textarea + save / cancel
// ---------------------------------------------------------------------------

export interface MarkdownEditDialogProps {
  open: boolean;
  initialContent: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  /** Override dialog heading; defaults to the localized Markdown title. */
  title?: string;
  /** Override the textarea placeholder. */
  placeholder?: string;
  /** Optional extra UI rendered between the heading and the textarea. */
  headerExtras?: React.ReactNode;
}

export function MarkdownEditDialog({
  open,
  initialContent,
  onSubmit,
  onCancel,
  title,
  placeholder,
  headerExtras,
}: MarkdownEditDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset local value whenever the dialog re-opens with a new initial.
  useEffect(() => {
    if (open) setValue(initialContent);
  }, [open, initialContent]);

  // Esc → cancel. Bound at document level so it works even when the
  // textarea has focus and the keydown bubbles past tldraw's own handlers.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  // Render via Portal to document.body so the dialog escapes tldraw's
  // shape-internal transform/scaling (which was making the dialog visually
  // distort and overlay tldraw selection handles).
  if (typeof document === "undefined") return null;
  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="markdown-edit-dialog-title"
      onClick={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="markdown-edit-dialog-title" className="mb-4 text-lg font-semibold text-ink-navy">
          {title ?? t("shapes.markdown.editDialogTitle")}
        </h2>
        {headerExtras && <div className="mb-4">{headerExtras}</div>}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? t("shapes.markdown.editPlaceholder")}
          rows={14}
          className="w-full rounded-lg border border-warm-200 px-3 py-2 font-mono text-sm focus:border-ink-navy focus:outline-none focus:ring-1 focus:ring-ink-navy"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            {t("shapes.common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(value)}
            className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink-navy/90"
          >
            {t("shapes.common.save")}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(dialog, document.body);
}
