/**
 * TokenUsageFooter.tsx — per-run + thread-cumulative token usage display.
 *
 * Spec ref: ai-side-panel "Token usage footer displays per-run and cumulative usage"
 *
 * Cost rendering boundary cases (also covered by tests):
 *   100 input / 50 output @ openai/gpt-4o-mini → $0.0001
 *   1 input / 1 output                           → <$0.0001
 *   0 / 0                                        → $0.0000
 *   null usage                                   → "—"
 */

import { useTranslation } from "react-i18next";
import { getPricingForModel } from "@vellum/shared/byok-pricing";

export interface TokenUsageFooterProps {
  thisRun: {
    input: number;
    output: number;
    provider: "openai" | "anthropic" | "google";
    model: string;
  } | null;
  threadTotal: { input: number; output: number };
  /** Provider/model used to price the thread total. Falls back to thisRun
   * provider/model if thread aggregate spans multiple — the rough estimate
   * is acceptable per spec (footer carries `*估算值，以 provider 帳單為準`). */
  threadPriceModel?: { provider: "openai" | "anthropic" | "google"; model: string } | null;
}

/**
 * Compute the USD cost for a (input, output, model) tuple.
 *
 * Returns:
 *   "—"          when usage is null or model unknown
 *   "<$0.0001"   when 0 < cost < 0.0001
 *   "$X.XXXX"    otherwise
 */
export function formatCost(
  input: number,
  output: number,
  model: string | null | undefined,
): string {
  if (model === null || model === undefined) return "—";
  const row = getPricingForModel(model);
  if (!row) return "—";
  const cost = (input / 1_000_000) * row.inputUsdPer1M + (output / 1_000_000) * row.outputUsdPer1M;
  if (cost === 0) return "$0.0000";
  if (cost < 0.0001) return "<$0.0001";
  return `$${cost.toFixed(4)}`;
}

export function TokenUsageFooter({
  thisRun,
  threadTotal,
  threadPriceModel,
}: TokenUsageFooterProps) {
  const { t } = useTranslation();
  const totalModel = threadPriceModel?.model ?? thisRun?.model ?? null;
  return (
    <div
      className="flex flex-col gap-1 border-t border-border/30 px-3 py-2 text-[11px] text-text-muted"
      data-testid="token-usage-footer"
    >
      <div className="flex items-center justify-between" data-testid="usage-this-run">
        <span>{t("agent.usage.thisRun")}</span>
        {thisRun ? (
          <span>
            {t("agent.usage.inputTokens", { count: thisRun.input })}
            {" · "}
            {t("agent.usage.outputTokens", { count: thisRun.output })}
            {" · "}
            {formatCost(thisRun.input, thisRun.output, thisRun.model)}
          </span>
        ) : (
          <span>{t("agent.usage.noUsage")}</span>
        )}
      </div>
      <div className="flex items-center justify-between" data-testid="usage-thread-total">
        <span>{t("agent.usage.threadTotal")}</span>
        <span>
          {t("agent.usage.inputTokens", { count: threadTotal.input })}
          {" · "}
          {t("agent.usage.outputTokens", { count: threadTotal.output })}
          {" · "}
          {formatCost(threadTotal.input, threadTotal.output, totalModel)}
        </span>
      </div>
    </div>
  );
}
