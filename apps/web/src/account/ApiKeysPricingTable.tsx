/**
 * ApiKeysPricingTable — pricing reference grouped by provider.
 *
 * Renders three provider sections (Anthropic / OpenAI / Google), each
 * with the provider's name + vendor pricing link in the section header
 * (rendered once per provider, not per row), followed by a four-column
 * table of three tier rows. Nine data rows total, no repeated provider
 * names anywhere.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Pricing table groups by provider with no repeated provider name"
 */

import { useTranslation } from "react-i18next";
import {
  BYOK_PRICING,
  type PricingRow,
  type ProviderId,
  type Tier,
} from "@vellum/shared/byok-pricing";

const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "google"];
const TIER_ORDER: Tier[] = ["flagship", "balanced", "economy"];

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function rowsForProvider(providerId: ProviderId): PricingRow[] {
  return BYOK_PRICING.filter((r) => r.providerId === providerId).sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
}

export function ApiKeysPricingTable() {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-border p-4">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">{t("account.apiKeys.pricing.title")}</h2>
        <p className="text-xs text-text-muted">{t("account.apiKeys.pricing.subtitle")}</p>
      </header>

      <div className="space-y-5">
        {PROVIDER_ORDER.map((providerId) => {
          const rows = rowsForProvider(providerId);
          const vendorUrl = rows[0]?.vendorPricingUrl ?? "#";
          return (
            <article
              key={providerId}
              data-testid={`byok-pricing-section-${providerId}`}
              className="border-t border-border pt-4 first:border-t-0 first:pt-0"
            >
              <div
                data-testid={`byok-pricing-header-${providerId}`}
                className="mb-2 flex items-baseline justify-between gap-2"
              >
                <h3 className="text-sm font-semibold text-text-primary">
                  {t(`account.apiKeys.providers.${providerId}.label`)}
                </h3>
                <a
                  data-testid={`byok-pricing-vendor-link-${providerId}`}
                  href={vendorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent-purple underline"
                >
                  {t("account.apiKeys.pricing.column.link")}
                </a>
              </div>

              <table className="w-full text-left text-sm tabular-nums">
                <thead className="text-xs uppercase text-text-muted">
                  <tr>
                    <th className="py-1 font-normal">{t("account.apiKeys.pricing.column.tier")}</th>
                    <th className="py-1 font-normal">
                      {t("account.apiKeys.pricing.column.model")}
                    </th>
                    <th className="py-1 text-right font-normal">
                      {t("account.apiKeys.pricing.column.inputCost")}
                    </th>
                    <th className="py-1 text-right font-normal">
                      {t("account.apiKeys.pricing.column.outputCost")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.modelId}
                      data-testid="byok-pricing-row"
                      className="border-t border-border"
                    >
                      <td className="py-1.5 text-text-primary">
                        {t(`account.apiKeys.pricing.tier.${row.tier}`)}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-text-primary">{row.modelId}</td>
                      <td className="py-1.5 text-right text-text-primary">
                        {formatUsd(row.inputUsdPer1M)}
                      </td>
                      <td className="py-1.5 text-right text-text-primary">
                        {formatUsd(row.outputUsdPer1M)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          );
        })}
      </div>
    </section>
  );
}
