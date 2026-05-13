/**
 * FolderCreateDialog — modal for creating a new folder.
 *
 * Uses react-hook-form + zod for validation (name 1-80 chars).
 * Calls onConfirm(name) on submit.
 * Spec: "Folder tree component renders flat list with drag targets"
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const schema = z.object({
  name: z.string().min(1).max(80),
});
type Fields = z.infer<typeof schema>;

export interface FolderCreateDialogProps {
  open: boolean;
  onConfirm: (name: string) => void;
  onClose: () => void;
  isPending?: boolean;
}

export function FolderCreateDialog({
  open,
  onConfirm,
  onClose,
  isPending = false,
}: FolderCreateDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Fields>({ resolver: zodResolver(schema) });

  if (!open) return null;

  function onSubmit({ name }: Fields) {
    onConfirm(name);
    reset();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-create-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
        <h2 id="folder-create-title" className="mb-4 text-lg font-semibold text-text-primary">
          {t("folder.create")}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input
            type="text"
            aria-label={t("folder.create")}
            className="mb-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
            placeholder={t("folder.namePlaceholder")}
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
              {isPending ? "…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
