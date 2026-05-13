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
import { DialogMotion, DialogPanel } from "../motion/dialog";

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
    values: { title: currentTitle },
  });

  return (
    <DialogMotion
      open={open}
      ariaLabelledBy="canvas-rename-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <DialogPanel className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
        <h2 id="canvas-rename-title" className="mb-4 text-lg font-semibold text-text-primary">
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
            className="mb-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
            {...register("title")}
            autoFocus
          />
          {errors.title && <p className="mb-3 text-xs text-accent-red">{errors.title.message}</p>}
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
      </DialogPanel>
    </DialogMotion>
  );
}
