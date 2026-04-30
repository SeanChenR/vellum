/**
 * CanvasMoveDialog — pick a target folder (or "Unfiled") for an existing canvas.
 *
 * The current folder is shown with a badge. Confirming with the same folder
 * is a no-op (button stays enabled but onConfirm is still invoked — the
 * caller's mutation handles the trivial PATCH).
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Folder } from "../dashboard/useFolderList";

export interface CanvasMoveDialogProps {
  open: boolean;
  currentFolderId: string | null;
  folders: Folder[];
  onConfirm: (targetFolderId: string | null) => void;
  onClose: () => void;
  isPending?: boolean;
}

const UNFILED_VALUE = "__unfiled__";

export function CanvasMoveDialog({
  open,
  currentFolderId,
  folders,
  onConfirm,
  onClose,
  isPending = false,
}: CanvasMoveDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>(currentFolderId ?? UNFILED_VALUE);

  useEffect(() => {
    if (open) setSelected(currentFolderId ?? UNFILED_VALUE);
  }, [open, currentFolderId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = () => {
    onConfirm(selected === UNFILED_VALUE ? null : selected);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-move-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="canvas-move-title" className="mb-4 text-lg font-semibold text-ink-navy">
          {t("canvas.dialog.move.title")}
        </h2>

        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-ink-navy/10 p-1">
          <FolderRow
            value={UNFILED_VALUE}
            label={t("canvas.dialog.move.unfiled")}
            isSelected={selected === UNFILED_VALUE}
            isCurrent={currentFolderId === null}
            currentLabel={t("canvas.dialog.move.currentBadge")}
            onSelect={() => setSelected(UNFILED_VALUE)}
          />
          {folders.map((f) => (
            <FolderRow
              key={f.id}
              value={f.id}
              label={f.name}
              isSelected={selected === f.id}
              isCurrent={currentFolderId === f.id}
              currentLabel={t("canvas.dialog.move.currentBadge")}
              onSelect={() => setSelected(f.id)}
            />
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-warm-sepia hover:bg-parchment-cream"
          >
            {t("canvas.dialog.move.cancelButton")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink-navy/90 disabled:opacity-50"
          >
            {t("canvas.dialog.move.confirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FolderRowProps {
  value: string;
  label: string;
  isSelected: boolean;
  isCurrent: boolean;
  currentLabel: string;
  onSelect: () => void;
}

function FolderRow({
  value,
  label,
  isSelected,
  isCurrent,
  currentLabel,
  onSelect,
}: FolderRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        data-value={value}
        className={[
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
          isSelected ? "bg-ink-navy/10 text-ink-navy" : "text-ink-navy hover:bg-parchment-cream",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        {isCurrent && (
          <span className="ml-2 shrink-0 rounded-full bg-warm-200 px-2 py-0.5 text-xs text-warm-sepia">
            {currentLabel}
          </span>
        )}
      </button>
    </li>
  );
}
