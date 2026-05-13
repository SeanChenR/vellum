/**
 * CanvasDeleteDialog — confirmation modal before deleting a canvas.
 *
 * Destructive action: does NOT call DELETE /api/canvas/:id until user
 * explicitly clicks the confirm button.
 *
 * Spec: "Canvas card opens delete confirmation from context menu"
 */

import React from "react";
import { useTranslation } from "react-i18next";

export interface CanvasDeleteDialogProps {
  open: boolean;
  canvasTitle: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
}

export function CanvasDeleteDialog({
  open,
  canvasTitle,
  onConfirm,
  onClose,
  isPending = false,
}: CanvasDeleteDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
        <h2 id="canvas-delete-title" className="mb-2 text-lg font-semibold text-text-primary">
          {t("canvas.dialog.delete.title")}
        </h2>
        <p className="mb-6 text-sm text-text-muted">
          {t("canvas.dialog.delete.confirm", { title: canvasTitle })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-visible-ring rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-surface-elevated"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="focus-visible-ring rounded-lg bg-accent-red px-4 py-2 text-sm font-semibold text-white hover:bg-accent-red/90 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
