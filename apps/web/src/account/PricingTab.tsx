/**
 * PricingTab — `/account?tab=pricing` panel content.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 11
 * Spec ref:   openspec/specs/account/spec.md
 *   "Pricing tab renders BYOK pricing as provider-grouped tier cards"
 *
 * Layout: three elevated cards, one per brand (Claude / OpenAI / Gemini),
 * each with a 3 px brand-colored top accent and a header row (40 px
 * logo + brand name). Inside the card body sits a `<table>` listing
 * the three tiers — columns: tier (badge), model id, input price,
 * output price. Tables are the natural representation for this kind
 * of comparison; per UX feedback we keep the per-provider grouping
 * (3 small tables) instead of one big 9-row monolith.
 *
 * Shared unit ("USD / 1M tokens") lives once in the section subtitle,
 * not on every row, so the tables stay compact.
 */

import { Leaf, Scale, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { BYOK_PRICING, type PricingRow, type Tier } from "@vellum/shared/byok-pricing";
import type { ProviderId } from "@vellum/shared";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import claudePng from "../assets/providers/claude.png";
import openaiPng from "../assets/providers/openai.png";
import geminiPng from "../assets/providers/gemini.png";

interface ProviderMeta {
  id: ProviderId;
  iconSrc: string;
  headingKey: string;
  brandColor: string;
}

const PROVIDER_META: readonly ProviderMeta[] = [
  {
    id: "anthropic",
    iconSrc: claudePng,
    headingKey: "account.pricing.modelFamily.anthropic",
    brandColor: "#D97757",
  },
  {
    id: "openai",
    iconSrc: openaiPng,
    headingKey: "account.pricing.modelFamily.openai",
    brandColor: "#10A37F",
  },
  {
    id: "google",
    iconSrc: geminiPng,
    headingKey: "account.pricing.modelFamily.google",
    brandColor: "#4796E3",
  },
] as const;

const TIER_ORDER: readonly Tier[] = ["flagship", "balanced", "economy"] as const;

interface TierMeta {
  tone: BadgeTone;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  iconClass: string;
}

const TIER_META: Record<Tier, TierMeta> = {
  flagship: { tone: "purple", Icon: Sparkles, iconClass: "text-accent-purple" },
  balanced: { tone: "cyan", Icon: Scale, iconClass: "text-accent-cyan" },
  // Economy = sky-blue. `cyan` is teal-leaning (#0D9488), and any other
  // green tone read too close to cyan in light mode — sky is a different
  // hue family so the three tiers (purple / teal-cyan / sky-blue) stay
  // clearly distinguishable. Uses the Aura --accent-sky token.
  economy: { tone: "sky", Icon: Leaf, iconClass: "text-accent-sky" },
};

function rowsForProvider(provider: ProviderId): PricingRow[] {
  return BYOK_PRICING.filter((r) => r.providerId === provider).sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
}

export function PricingTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-serif text-2xl font-semibold text-text-primary">
          {t("account.pricing.title")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">{t("account.pricing.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PROVIDER_META.map(({ id, iconSrc, headingKey, brandColor }) => {
          const rows = rowsForProvider(id);
          return (
            <Card
              key={id}
              variant="elevated"
              data-testid={`pricing-card-${id}`}
              className="!p-0 overflow-hidden transition-shadow duration-150 hover:shadow-lg"
              style={{ borderTop: `3px solid ${brandColor}` }}
            >
              <header className="flex items-center gap-3 border-b border-text-muted/15 px-5 py-4">
                <img
                  src={iconSrc}
                  alt=""
                  data-testid={`pricing-brand-icon-${id}`}
                  aria-hidden
                  className="h-9 w-9 flex-shrink-0 object-contain"
                  draggable={false}
                />
                <h3 className="font-serif text-lg font-semibold text-text-primary">
                  {t(headingKey)}
                </h3>
              </header>

              <table
                data-testid={`pricing-table-${id}`}
                className="w-full border-collapse text-left text-xs"
              >
                <thead>
                  <tr className="border-b border-text-muted/15 text-[10px] uppercase tracking-wider text-text-muted">
                    <th scope="col" className="px-5 py-2 font-medium">
                      {t("account.pricing.tierHeader")}
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      {t("account.pricing.inputLabel")}
                    </th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">
                      {t("account.pricing.outputLabel")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const tier = TIER_META[row.tier];
                    const TierIcon = tier.Icon;
                    return (
                      <tr
                        key={row.modelId}
                        data-testid={`pricing-row-${id}-${row.tier}`}
                        className="border-b border-text-muted/10 last:border-b-0"
                      >
                        <th scope="row" className="px-5 py-4 align-top font-normal">
                          {/* gap-4 (16 px) matches the cell's py-4 so the
                              model-id has equal vertical breathing room
                              above (from the badge) and below (to the
                              row divider). */}
                          <div className="flex flex-col gap-4">
                            <Badge tone={tier.tone}>
                              <TierIcon
                                size={12}
                                aria-hidden
                                data-testid={`pricing-tier-icon-${id}-${row.tier}`}
                                className={tier.iconClass}
                              />
                              <span className="ml-1">{t(`account.pricing.tier.${row.tier}`)}</span>
                            </Badge>
                            <span className="font-mono text-[10px] text-text-muted">
                              {row.modelId}
                            </span>
                          </div>
                        </th>
                        <td className="px-2 py-3 text-right align-top font-mono text-sm font-semibold text-text-primary">
                          ${row.inputUsdPer1M.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right align-top font-mono text-sm font-semibold text-text-primary">
                          ${row.outputUsdPer1M.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
