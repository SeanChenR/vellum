/**
 * ApiKeyRow — one Settings → API Keys row for a given provider.
 *
 * Extracted from the original ApiKeysPage so the same interaction logic
 * (empty / saved / save-error / delete-confirm) renders for any of the
 * three supported providers without duplicate JSX.
 *
 * Visual styling and the delete-confirm modal placement still live in
 * the parent ApiKeysPage; the row owns its own input / showInput /
 * confirmingDelete state and dispatches mutations via useApiKeys hooks.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Settings API Keys page UI" — every row behaves identically across
 *     anthropic / openai / google.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderId } from "@vellum/shared";
import { BYOK_PRICING, type PricingRow, type Tier } from "@vellum/shared/byok-pricing";
import { useApiKeysList, useDeleteApiKey, useSaveApiKey, useUpdatePreferences } from "./useApiKeys";

const MASKED = "•••••••••••";
const TIER_ORDER: Tier[] = ["flagship", "balanced", "economy"];

function tierOptionsFor(provider: ProviderId): PricingRow[] {
  return BYOK_PRICING.filter((r) => r.providerId === provider).sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
}

export interface ApiKeyRowProps {
  provider: ProviderId;
}

export function ApiKeyRow({ provider }: ApiKeyRowProps) {
  const { t } = useTranslation();
  const list = useApiKeysList();
  const save = useSaveApiKey(provider);
  const del = useDeleteApiKey(provider);
  const updatePref = useUpdatePreferences();

  const [input, setInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const isSaved = (list.data?.keys ?? []).some((k) => k.provider === provider);
  const showEmptyForm = !isSaved || showInput;
  const currentDefaultModel = list.data?.preferences?.[provider]?.model ?? "";

  const errorKey = save.error instanceof Error ? save.error.message : null;
  const tierRows = tierOptionsFor(provider);

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
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium">{t(`account.apiKeys.providers.${provider}.label`)}</div>
          <a
            href={t(`account.apiKeys.providers.${provider}.helpUrl`)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 underline"
          >
            {t(`account.apiKeys.providers.${provider}.helpUrl`)}
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
            placeholder={t(`account.apiKeys.providers.${provider}.placeholder`)}
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

      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <label htmlFor={`default-model-${provider}`} className="text-xs font-medium text-gray-600">
          {t("account.apiKeys.defaultModel.title")}
        </label>
        <select
          id={`default-model-${provider}`}
          value={currentDefaultModel}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "") return;
            updatePref.mutate({ provider, model: next });
          }}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">{t("account.apiKeys.defaultModel.unset")}</option>
          {tierRows.map((row) => (
            <option key={row.modelId} value={row.modelId}>
              {`${t(`account.apiKeys.pricing.tier.${row.tier}`)} — ${row.modelId}`}
            </option>
          ))}
        </select>
      </div>

      {confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`apikeys-delete-title-${provider}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 id={`apikeys-delete-title-${provider}`} className="mb-2 text-lg font-semibold">
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
