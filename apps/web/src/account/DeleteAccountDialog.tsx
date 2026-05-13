/**
 * DeleteAccountDialog — permanently deletes the account.
 *
 * - Requires typing the user's own email to confirm (case-insensitive)
 * - Submit is disabled while email doesn't match
 * - On success: DELETE /api/account → navigate to /login
 */

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [confirmEmail, setConfirmEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches =
    confirmEmail.toLowerCase().trim() === (user?.email ?? "").toLowerCase().trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailMatches || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const resp = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });

      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as {
          error?: { errorKey: string };
        };
        setError(body.error?.errorKey ?? "account.errors.deleteFailed");
        setIsSubmitting(false);
        return;
      }

      await logout();
      void navigate({ to: "/login" });
    } catch {
      setError("account.errors.deleteFailed");
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-8 shadow-xl">
        <h2 id="delete-account-title" className="text-lg font-semibold text-accent-red mb-4">
          {t("account.deleteAccount.title")}
        </h2>

        <p className="text-sm text-text-muted mb-6">{t("account.deleteAccount.warning")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="confirm-email"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              {t("account.deleteAccount.confirmEmailLabel")}
            </label>
            <input
              id="confirm-email"
              type="email"
              autoComplete="off"
              aria-label={t("account.deleteAccount.confirmEmailLabel")}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-red"
            />
          </div>

          {error && <p className="text-sm text-accent-red">{t(error, { defaultValue: error })}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary hover:bg-surface-elevated"
            >
              {t("account.deleteAccount.cancelButton")}
            </button>

            <button
              type="submit"
              aria-label={t("account.deleteAccount.confirmButton")}
              disabled={!emailMatches || isSubmitting}
              className="flex-1 rounded-lg bg-accent-red px-4 py-3 text-sm font-semibold text-white hover:bg-accent-red/90 disabled:opacity-40"
            >
              {t("account.deleteAccount.confirmButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
