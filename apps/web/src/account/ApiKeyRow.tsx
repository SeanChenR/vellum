/**
 * ApiKeyRow — one row of the API & MCP tab BYOK section.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 12
 * Spec ref:   openspec/specs/account/spec.md
 *   "API & MCP tab uses row-based layout with saved-state indicator"
 *
 * Three vertical zones with generous breathing room:
 *   1. Identity   — 40 px brand logo + provider name + saved badge + console link
 *   2. Credential — masked key OR password input + primary action(s)
 *   3. Default model — labelled selector on its own visual subsection
 *
 * Layout: `px-6 py-5` + 16/20 px gaps between zones so each section has
 * room to breathe; previously everything was crammed into a single
 * 16 px-padded block.
 */

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderId } from "@vellum/shared";
import { BYOK_PRICING, type PricingRow, type Tier } from "@vellum/shared/byok-pricing";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useApiKeysList, useDeleteApiKey, useSaveApiKey, useUpdatePreferences } from "./useApiKeys";
import anthropicPng from "../assets/providers/anthropic.png";
import openaiPng from "../assets/providers/openai.png";
import googlePng from "../assets/providers/google.png";

const MASKED = "•••••••••••";
const TIER_ORDER: Tier[] = ["flagship", "balanced", "economy"];

const PROVIDER_LOGO: Record<ProviderId, string> = {
  anthropic: anthropicPng,
  openai: openaiPng,
  google: googlePng,
};

function tierOptionsFor(provider: ProviderId): PricingRow[] {
  return BYOK_PRICING.filter((r) => r.providerId === provider).sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
  const helpUrl = t(`account.apiKeys.providers.${provider}.helpUrl`);

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
    <div className="space-y-5 px-6 py-8">
      {/* Zone 1: identity */}
      <div className="flex items-start gap-4">
        <img
          src={PROVIDER_LOGO[provider]}
          alt=""
          data-testid={`apikey-provider-logo-${provider}`}
          aria-hidden
          className="h-12 w-12 flex-shrink-0 object-contain"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-text-primary">
              {t(`account.apiKeys.providers.${provider}.label`)}
            </h4>
            {isSaved && (
              <Badge tone="cyan" dot data-testid={`apikey-saved-badge-${provider}`}>
                {t("account.apiKeys.savedBadge")}
              </Badge>
            )}
          </div>
          <a
            href={helpUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent-purple"
          >
            <span>{t("account.apiKeys.helpLinkLabel")}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">{hostnameOf(helpUrl)}</span>
            <ExternalLink size={11} aria-hidden />
          </a>
        </div>
      </div>

      {/* Zone 2: credential */}
      {showEmptyForm ? (
        <div className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder={t(`account.apiKeys.providers.${provider}.placeholder`)}
            className="focus-visible-ring h-10 w-full rounded-lg border border-border bg-surface px-3 font-mono text-sm text-text-primary placeholder:font-sans placeholder:text-text-muted"
            disabled={save.isPending}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!input.trim() || save.isPending}
            >
              {save.isPending
                ? t("account.apiKeys.status.saving")
                : t("account.apiKeys.actions.save")}
            </Button>
            {isSaved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowInput(false);
                  setInput("");
                }}
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
          {errorKey && <p className="text-xs text-accent-red">{t(errorKey)}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="font-mono text-sm tracking-wider text-text-primary">{MASKED}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowInput(true);
              }}
            >
              {t("account.apiKeys.actions.replace")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmingDelete(true);
              }}
            >
              {t("account.apiKeys.actions.delete")}
            </Button>
          </div>
        </div>
      )}

      {/* Zone 3: default model — no internal divider; the panel-level
          divider lives between providers in ApiKeysTab. */}
      <div className="space-y-2">
        <label
          htmlFor={`default-model-${provider}`}
          className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted"
        >
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
          className="focus-visible-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h2
              id={`apikeys-delete-title-${provider}`}
              className="mb-2 text-lg font-semibold text-text-primary"
            >
              {t("account.apiKeys.confirm.deleteTitle")}
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              {t("account.apiKeys.confirm.deleteBody")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirmingDelete(false);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={del.isPending}
              >
                {t("account.apiKeys.actions.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
