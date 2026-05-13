/**
 * ApiKeysPage — Settings → API Keys.
 *
 * Three rows (one per supported provider) + static pricing table +
 * default-model picker. Per-row interaction logic lives in `ApiKeyRow`;
 * this page orchestrates their composition and the preferences mutation.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Settings API Keys page UI"
 * Design ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/design.md
 *     "Settings UI — 資料驅動三 row + 嵌入定價表 + 底部 picker"
 */

import { useTranslation } from "react-i18next";
import type { ProviderId } from "@vellum/shared";
import { ApiKeyRow } from "./ApiKeyRow";
import { ApiKeysPricingTable } from "./ApiKeysPricingTable";
import { PatTokensSection } from "./PatTokensSection";

const PROVIDERS: readonly ProviderId[] = ["anthropic", "openai", "google"] as const;

export function ApiKeysPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="mb-2 text-2xl font-semibold">{t("account.apiKeys.title")}</h1>
        <p className="text-sm text-gray-600">{t("account.apiKeys.subtitle")}</p>
      </header>

      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <ApiKeyRow key={p} provider={p} />
        ))}
      </div>

      <ApiKeysPricingTable />

      <hr className="my-8 border-gray-200" />

      <PatTokensSection />
    </div>
  );
}
