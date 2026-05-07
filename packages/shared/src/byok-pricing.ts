/**
 * byok-pricing.ts — static BYOK pricing catalog.
 *
 * Single source of truth for the nine (provider × tier) model rows that
 * BYOK supports. Consumed by:
 *   - the Settings UI pricing table
 *   - the preferences validator (rejects unknown model ids)
 *   - any future agent runtime model lookup
 *
 * Lives in `packages/shared` because both the server (validator) and the
 * web client (Settings UI) read it. Pricing values are static text — when
 * a vendor changes price, edit this file; CI catches all consumers via
 * `BYOK_PRICING` references.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *   "BYOK pricing catalog as a static module"
 */

export type ProviderId = "anthropic" | "openai" | "google";

export type Tier = "flagship" | "balanced" | "economy";

export interface PricingRow {
  providerId: ProviderId;
  tier: Tier;
  /** Canonical model identifier used by adapters and the agent runtime. */
  modelId: string;
  /** USD per 1M input tokens. */
  inputUsdPer1M: number;
  /** USD per 1M output tokens. */
  outputUsdPer1M: number;
  /** Vendor pricing page link — surfaced as a "Details" link in the UI. */
  vendorPricingUrl: string;
}

const ANTHROPIC_PRICING_URL = "https://www.anthropic.com/pricing";
const OPENAI_PRICING_URL = "https://openai.com/api/pricing/";
const GOOGLE_PRICING_URL = "https://ai.google.dev/pricing";

export const BYOK_PRICING: readonly PricingRow[] = [
  {
    providerId: "anthropic",
    tier: "flagship",
    modelId: "claude-opus-4-5",
    inputUsdPer1M: 15.0,
    outputUsdPer1M: 75.0,
    vendorPricingUrl: ANTHROPIC_PRICING_URL,
  },
  {
    providerId: "anthropic",
    tier: "balanced",
    modelId: "claude-sonnet-4-6",
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    vendorPricingUrl: ANTHROPIC_PRICING_URL,
  },
  {
    providerId: "anthropic",
    tier: "economy",
    modelId: "claude-haiku-4-5",
    inputUsdPer1M: 1.0,
    outputUsdPer1M: 5.0,
    vendorPricingUrl: ANTHROPIC_PRICING_URL,
  },
  {
    providerId: "openai",
    tier: "flagship",
    modelId: "gpt-5",
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.0,
    vendorPricingUrl: OPENAI_PRICING_URL,
  },
  {
    providerId: "openai",
    tier: "balanced",
    modelId: "gpt-5-mini",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 2.0,
    vendorPricingUrl: OPENAI_PRICING_URL,
  },
  {
    providerId: "openai",
    tier: "economy",
    modelId: "gpt-5-nano",
    inputUsdPer1M: 0.05,
    outputUsdPer1M: 0.4,
    vendorPricingUrl: OPENAI_PRICING_URL,
  },
  {
    providerId: "google",
    tier: "flagship",
    modelId: "gemini-2.5-pro",
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.0,
    vendorPricingUrl: GOOGLE_PRICING_URL,
  },
  {
    providerId: "google",
    tier: "balanced",
    modelId: "gemini-2.5-flash",
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    vendorPricingUrl: GOOGLE_PRICING_URL,
  },
  {
    providerId: "google",
    tier: "economy",
    modelId: "gemini-2.5-flash-lite",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    vendorPricingUrl: GOOGLE_PRICING_URL,
  },
] as const;

export function getPricingForModel(modelId: string): PricingRow | undefined {
  return BYOK_PRICING.find((row) => row.modelId === modelId);
}

export function isKnownModel(modelId: string): boolean {
  return getPricingForModel(modelId) !== undefined;
}
