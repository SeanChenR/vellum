/**
 * CanvasRenameDialog — modal for renaming an existing canvas.
 *
 * Pre-fills current title. Calls onConfirm(newTitle) on submit.
 * Spec: "Canvas card opens rename dialog from context menu"
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const schema = z.object({ title: z.string().min(1).max(120) });
type Fields = z.infer<typeof schema>;

export interface CanvasRenameDialogProps {
  open: boolean;
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onClose: () => void;
  isPending?: boolean;
}

export function CanvasRenameDialog({
  open,
  currentTitle,
  onConfirm,
  onClose,
  isPending = false,
}: CanvasRenameDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { title: currentTitle },
  });

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-rename-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="canvas-rename-title" className="mb-4 text-lg font-semibold">
          {t("canvas.dialog.rename.title")}
        </h2>
        <form
          onSubmit={handleSubmit(({ title }) => {
            onConfirm(title);
            reset({ title });
          })}
        >
          <input
            type="text"
            className="mb-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-navy"
            {...register("title")}
            autoFocus
          />
          {errors.title && (
            <p className="mb-3 text-xs text-red-600">{errors.title.message}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { reset(); onClose(); }} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {isPending ? "…" : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
