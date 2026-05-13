/**
 * ApiKeysTab — `/account?tab=api-keys` panel content.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 12
 * Spec ref:   openspec/specs/account/spec.md
 *   "API & MCP tab uses row-based layout with saved-state indicator"
 *
 * BYOK provider rows are wrapped in a SINGLE elevated Card with
 * `divide-y divide-border` separating each provider, NOT three separate
 * cards. MCP token list lives in `<PatTokensSection />` below.
 *
 * The pricing table is NOT rendered here — it now lives in PricingTab.
 */

import { useTranslation } from "react-i18next";
import type { ProviderId } from "@vellum/shared";
import { Card } from "../components/ui/Card";
import { ApiKeyRow } from "./ApiKeyRow";
import { PatTokensSection } from "./PatTokensSection";

const PROVIDERS: readonly ProviderId[] = ["anthropic", "openai", "google"] as const;

export function ApiKeysTab() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section data-testid="apikeys-section-providers" aria-labelledby="section-providers">
        <header className="mb-6">
          <h2
            id="section-providers"
            className="mb-2 font-serif text-2xl font-semibold text-text-primary"
          >
            {t("account.apiKeys.title")}
          </h2>
          <p className="text-sm text-text-muted">{t("account.apiKeys.subtitle")}</p>
        </header>

        <Card className="!p-0">
          <div className="divide-y divide-text-muted/15">
            {PROVIDERS.map((p) => (
              <ApiKeyRow key={p} provider={p} />
            ))}
          </div>
        </Card>
      </section>

      <section data-testid="apikeys-section-mcp-tokens">
        <PatTokensSection />
      </section>
    </div>
  );
}
