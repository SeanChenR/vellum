/**
 * FolderDeleteDialog — confirmation modal before deleting a folder.
 *
 * Destructive action: does NOT call DELETE /api/folder/:id until user
 * explicitly clicks the confirm button.
 *
 * Handles the `errors.folder.notEmpty` error from the API by showing
 * an inline message prompting the user to move canvases out first.
 *
 * Spec: "Folder delete with non-empty guard"
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { DialogMotion, DialogPanel } from "../motion/dialog";

export interface FolderDeleteDialogProps {
  open: boolean;
  folderName: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
  /** Set to "errors.folder.notEmpty" to show the not-empty error message */
  errorKey?: string | null;
}

export function FolderDeleteDialog({
  open,
  folderName,
  onConfirm,
  onClose,
  isPending = false,
  errorKey = null,
}: FolderDeleteDialogProps) {
  const { t } = useTranslation();

  return (
    <DialogMotion
      open={open}
      ariaLabelledBy="folder-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="folder-delete-title" className="mb-2 text-lg font-semibold">
          {t("folder.delete")}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {t("folder.deleteConfirm", { name: folderName })}
        </p>

        {errorKey === "errors.folder.notEmpty" && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {t("errors.folder.notEmpty")}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </DialogPanel>
    </DialogMotion>
  );
}
