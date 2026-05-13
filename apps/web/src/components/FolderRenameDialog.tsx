/**
 * FolderRenameDialog — modal for renaming an existing folder.
 *
 * Pre-fills current name. Calls onConfirm(newName) on submit.
 * Spec: "Folder tree component renders flat list with drag targets"
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const schema = z.object({ name: z.string().min(1).max(80) });
type Fields = z.infer<typeof schema>;

export interface FolderRenameDialogProps {
  open: boolean;
  currentName: string;
  onConfirm: (newName: string) => void;
  onClose: () => void;
  isPending?: boolean;
}

export function FolderRenameDialog({
  open,
  currentName,
  onConfirm,
  onClose,
  isPending = false,
}: FolderRenameDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    values: { name: currentName },
  });

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-rename-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
        <h2 id="folder-rename-title" className="mb-4 text-lg font-semibold text-text-primary">
          {t("folder.rename")}
        </h2>
        <form
          onSubmit={handleSubmit(({ name }) => {
            onConfirm(name);
            reset({ name });
          })}
        >
          <input
            type="text"
            className="mb-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
            {...register("name")}
            autoFocus
          />
          {errors.name && <p className="mb-3 text-xs text-accent-red">{errors.name.message}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="focus-visible-ring rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-surface-elevated"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="focus-visible-ring rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "…" : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
