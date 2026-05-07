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
    <section className="rounded-lg border border-gray-200 p-4">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">{t("account.apiKeys.pricing.title")}</h2>
        <p className="text-xs text-gray-500">{t("account.apiKeys.pricing.subtitle")}</p>
      </header>

      <div className="space-y-5">
        {PROVIDER_ORDER.map((providerId) => {
          const rows = rowsForProvider(providerId);
          const vendorUrl = rows[0]?.vendorPricingUrl ?? "#";
          return (
            <article
              key={providerId}
              data-testid={`byok-pricing-section-${providerId}`}
              className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
            >
              <div
                data-testid={`byok-pricing-header-${providerId}`}
                className="mb-2 flex items-baseline justify-between gap-2"
              >
                <h3 className="text-sm font-semibold text-ink-navy">
                  {t(`account.apiKeys.providers.${providerId}.label`)}
                </h3>
                <a
                  data-testid={`byok-pricing-vendor-link-${providerId}`}
                  href={vendorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  {t("account.apiKeys.pricing.column.link")}
                </a>
              </div>

              <table className="w-full text-left text-sm tabular-nums">
                <thead className="text-xs uppercase text-gray-400">
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
                      className="border-t border-gray-100"
                    >
                      <td className="py-1.5 text-gray-700">
                        {t(`account.apiKeys.pricing.tier.${row.tier}`)}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-gray-700">{row.modelId}</td>
                      <td className="py-1.5 text-right text-gray-900">
                        {formatUsd(row.inputUsdPer1M)}
                      </td>
                      <td className="py-1.5 text-right text-gray-900">
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
