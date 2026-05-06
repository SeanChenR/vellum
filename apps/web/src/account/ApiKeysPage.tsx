/**
 * ApiKeysPage — Settings page for BYOK provider keys.
 *
 * Anthropic-only in M11.1. Two visual states per provider row:
 *   - empty:  password input + Save button (disabled until non-empty)
 *   - saved:  masked indicator (dots) + Delete + Replace buttons
 *
 * After Save the plaintext key is unrecoverable (encrypted on server,
 * never decrypted back). The masked indicator is purely a "key on file"
 * stand-in — no last-4 leak across reloads.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 *   "Settings UI — single Anthropic row, masked-when-stored, key never re-fetched".
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiKeysList, useDeleteApiKey, useSaveApiKey } from "./useApiKeys";

const PROVIDER = "anthropic";
const MASKED = "•••••••••••";

export function ApiKeysPage() {
  const { t } = useTranslation();
  const list = useApiKeysList();
  const save = useSaveApiKey(PROVIDER);
  const del = useDeleteApiKey(PROVIDER);

  const [input, setInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const isSaved = (list.data ?? []).some((k) => k.provider === PROVIDER);
  const showEmptyForm = !isSaved || showInput;

  const errorKey = save.error instanceof Error ? save.error.message : null;

  function handleSave() {
    if (!input.trim()) return;
    save.mutate(input, {
      onSuccess() {
        setInput("");
        setShowInput(false);
      },
    });
  }

  function handleConfirmDelete() {
    del.mutate(undefined, {
      onSuccess() {
        setConfirmingDelete(false);
        setShowInput(false);
      },
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">{t("account.apiKeys.title")}</h1>
      <p className="mb-6 text-sm text-gray-600">{t("account.apiKeys.subtitle")}</p>

      <div className="rounded-lg border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-medium">{t("account.apiKeys.providers.anthropic.label")}</div>
            <a
              href={t("account.apiKeys.providers.anthropic.helpUrl")}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 underline"
            >
              {t("account.apiKeys.providers.anthropic.helpUrl")}
            </a>
          </div>
        </div>

        {showEmptyForm ? (
          <div className="space-y-2">
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              placeholder={t("account.apiKeys.providers.anthropic.placeholder")}
              className="w-full rounded border border-gray-300 px-3 py-2"
              disabled={save.isPending}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!input.trim() || save.isPending}
                className="rounded bg-ink-navy px-4 py-2 text-white disabled:opacity-50"
              >
                {save.isPending
                  ? t("account.apiKeys.status.saving")
                  : t("account.apiKeys.actions.save")}
              </button>
              {isSaved && (
                <button
                  type="button"
                  onClick={() => {
                    setShowInput(false);
                    setInput("");
                  }}
                  className="text-sm text-gray-600 underline"
                >
                  {t("account.apiKeys.actions.delete")}
                </button>
              )}
            </div>
            {errorKey && <div className="text-sm text-red-600">{t(errorKey)}</div>}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="font-mono text-sm text-gray-700">{MASKED}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowInput(true);
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                {t("account.apiKeys.actions.replace")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(true);
                }}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
              >
                {t("account.apiKeys.actions.delete")}
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apikeys-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 id="apikeys-delete-title" className="mb-2 text-lg font-semibold">
              {t("account.apiKeys.confirm.deleteTitle")}
            </h2>
            <p className="mb-4 text-sm text-gray-600">{t("account.apiKeys.confirm.deleteBody")}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                {t("account.apiKeys.actions.replace")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={del.isPending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {t("account.apiKeys.actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
