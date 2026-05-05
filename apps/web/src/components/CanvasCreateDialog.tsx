/**
 * CanvasCreateDialog — modal for creating a new canvas.
 *
 * Uses react-hook-form + zod for validation (title 1-120 chars).
 * Calls onConfirm(title) on submit.
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const schema = z.object({
  title: z.string().min(1).max(120),
});
type Fields = z.infer<typeof schema>;

export interface CanvasCreateDialogProps {
  open: boolean;
  onConfirm: (title: string) => void;
  onClose: () => void;
  isPending?: boolean;
}

export function CanvasCreateDialog({
  open,
  onConfirm,
  onClose,
  isPending = false,
}: CanvasCreateDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Fields>({ resolver: zodResolver(schema) });

  if (!open) return null;

  function onSubmit({ title }: Fields) {
    onConfirm(title);
    reset();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-create-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="canvas-create-title" className="mb-4 text-lg font-semibold">
          {t("canvas.dialog.create.title")}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input
            type="text"
            aria-label={t("canvas.dialog.create.title")}
            className="mb-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-navy"
            placeholder={t("canvas.dialog.create.titlePlaceholder")}
            {...register("title")}
            autoFocus
          />
          {errors.title && <p className="mb-3 text-xs text-red-600">{errors.title.message}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="focus-visible-ring rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="focus-visible-ring rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
