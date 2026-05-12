/**
 * ChatComposer.tsx — input area for the AI Side Panel.
 *
 * Renders: textarea + provider/model dropdowns + Send / Cancel button.
 *
 * Behavior contract (ai-side-panel spec "Composer sends user message and
 * switches to Cancel during run"):
 *   - Cmd+Enter submits when state !== "running"
 *   - Cmd+. cancels when state === "running"
 *   - Send button is replaced by Cancel during a run
 *   - In-flight Cmd+Enter is ignored
 *
 * Picker contract (M14 verification gap fix):
 *   - Provider dropdown lists every provider in `availableProviders`.
 *   - Model dropdown lists every model in BYOK_PRICING for the selected
 *     provider. Switching provider resets the model to that provider's
 *     preference (or the first model in pricing if no preference exists).
 *   - When `availableProviders` is empty the textarea, both dropdowns,
 *     and the Send button are disabled and a hint pointing the user to
 *     Settings → API Keys is rendered in place of the dropdowns.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentRunState } from "./useAgentRun";
import { BYOK_PRICING } from "@vellum/shared/byok-pricing";
import type { BYOKPreferencesMap, BYOKProviderListItem, ProviderId } from "@vellum/shared";

export interface ChatComposerProps {
  draft: string;
  setDraft: (next: string) => void;
  state: AgentRunState;
  onSend(input: { provider: ProviderId; model: string; userMessage: string }): void;
  onCancel(): void;
  /** Per-provider model preferences from BYOK settings. */
  preferences: BYOKPreferencesMap;
  /** Provider keys the user has saved. */
  availableProviders: BYOKProviderListItem[];
}

function modelsForProvider(provider: ProviderId): string[] {
  return BYOK_PRICING.filter((row) => row.providerId === provider).map((row) => row.modelId);
}

function pickDefaultModel(provider: ProviderId, prefs: BYOKPreferencesMap): string {
  const preferred = prefs[provider]?.model;
  if (preferred) return preferred;
  return modelsForProvider(provider)[0] ?? "";
}

function pickInitialProvider(
  available: BYOKProviderListItem[],
  prefs: BYOKPreferencesMap,
): ProviderId | null {
  for (const p of available) {
    if (prefs[p.provider]?.model) return p.provider;
  }
  return available[0]?.provider ?? null;
}

export function ChatComposer(props: ChatComposerProps) {
  const { draft, setDraft, state, onSend, onCancel, preferences, availableProviders } = props;
  const { t } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const hasAnyProvider = availableProviders.length > 0;
  const initialProvider = useMemo(
    () => pickInitialProvider(availableProviders, preferences),
    [availableProviders, preferences],
  );
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(initialProvider);
  const [selectedModel, setSelectedModel] = useState<string>(
    initialProvider ? pickDefaultModel(initialProvider, preferences) : "",
  );

  // Re-sync when availableProviders / preferences change (e.g. user adds a
  // BYOK key in Settings without remounting the panel).
  useEffect(() => {
    if (!hasAnyProvider) {
      setSelectedProvider(null);
      setSelectedModel("");
      return;
    }
    if (!selectedProvider || !availableProviders.some((p) => p.provider === selectedProvider)) {
      const next = pickInitialProvider(availableProviders, preferences);
      setSelectedProvider(next);
      setSelectedModel(next ? pickDefaultModel(next, preferences) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableProviders, preferences]);

  const modelOptions = useMemo(
    () => (selectedProvider ? modelsForProvider(selectedProvider) : []),
    [selectedProvider],
  );

  const isRunning = state === "running";
  const composerDisabled = isRunning || !hasAnyProvider;

  function submit() {
    if (composerDisabled) return;
    if (!selectedProvider || !selectedModel || draft.trim().length === 0) return;
    onSend({
      provider: selectedProvider,
      model: selectedModel,
      userMessage: draft.trim(),
    });
    // Draft is cleared by the useEffect below once the run reaches a
    // success terminal (`done`). On `error` / `cancelled` we deliberately
    // keep the typed text so the user can retry without retyping — see
    // ai-side-panel spec "Rate limit response shows toast with errorKey
    // translation": "the typed prompt SHALL still be present in the
    // textarea".
  }

  // Track the previous run state so the clear-on-done transition only
  // fires once per terminal, even though React may re-render mid-update.
  const prevStateRef = useRef<AgentRunState>(state);
  useEffect(() => {
    if (prevStateRef.current === "running" && state === "done") {
      setDraft("");
    }
    prevStateRef.current = state;
  }, [state, setDraft]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        submit();
      }
      if ((ev.metaKey || ev.ctrlKey) && ev.key === ".") {
        if (isRunning) {
          ev.preventDefault();
          onCancel();
        }
      }
    }
    const ta = taRef.current;
    ta?.addEventListener("keydown", onKey);
    return () => ta?.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, draft, selectedProvider, selectedModel, hasAnyProvider]);

  function handleProviderChange(next: ProviderId) {
    setSelectedProvider(next);
    setSelectedModel(pickDefaultModel(next, preferences));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-warm-sepia/30 p-3">
      <textarea
        ref={taRef}
        data-testid="chat-composer-textarea"
        className="w-full resize-none rounded-md border border-warm-sepia/40 bg-white px-3 py-2 text-sm text-ink-navy focus:outline-none disabled:cursor-not-allowed disabled:bg-paper-cream/60"
        rows={3}
        placeholder={t("agent.panel.placeholder")}
        value={draft}
        disabled={composerDisabled}
        onChange={(e) => setDraft(e.target.value)}
      />
      {hasAnyProvider ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-warm-sepia">
            <label className="flex items-center gap-1">
              <span className="sr-only">{t("agent.panel.providerLabel")}</span>
              <select
                data-testid="chat-composer-provider-picker"
                value={selectedProvider ?? ""}
                disabled={isRunning}
                onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
                className="rounded border border-warm-sepia/40 bg-white px-1 py-0.5 text-[11px] text-ink-navy"
              >
                {availableProviders.map((p) => (
                  <option key={p.provider} value={p.provider}>
                    {p.provider}
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden>/</span>
            <label className="flex items-center gap-1">
              <span className="sr-only">{t("agent.panel.modelLabel")}</span>
              <select
                data-testid="chat-composer-model-picker"
                value={selectedModel}
                disabled={isRunning || modelOptions.length === 0}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="rounded border border-warm-sepia/40 bg-white px-1 py-0.5 text-[11px] text-ink-navy"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {isRunning ? (
            <button
              type="button"
              data-testid="chat-composer-cancel"
              onClick={onCancel}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600/90"
            >
              {t("agent.panel.cancel")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="chat-composer-send"
              onClick={submit}
              disabled={draft.trim().length === 0}
              className="rounded-md bg-ink-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink-navy/90 disabled:cursor-not-allowed disabled:bg-ink-navy/40"
            >
              {t("agent.panel.send")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p
            data-testid="chat-composer-no-api-key-hint"
            className="text-[11px] leading-tight text-warm-sepia"
          >
            {t("agent.panel.noApiKeyHint")}
          </p>
          <button
            type="button"
            data-testid="chat-composer-send"
            onClick={submit}
            disabled
            className="rounded-md bg-ink-navy px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink-navy/40"
          >
            {t("agent.panel.send")}
          </button>
        </div>
      )}
    </div>
  );
}
