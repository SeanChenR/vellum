/**
 * byok-pricing.test.ts — assertions for the static BYOK pricing catalog.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *   "BYOK pricing catalog as a static module"
 *
 * The catalog is the single source of truth consumed by:
 *   - the Settings UI pricing table
 *   - the preferences validator (rejects unknown model ids)
 *   - any future agent runtime model lookup
 *
 * Tests pin exact (provider, tier, modelId) coverage from the spec
 * Example table — these are the agreed nine rows, not invented values.
 */

import { describe, expect, test } from "bun:test";

import { BYOK_PRICING, getPricingForModel, isKnownModel } from "./byok-pricing";
import type { ProviderId, Tier } from "./byok-pricing";

const REQUIRED_ROWS: ReadonlyArray<{ providerId: ProviderId; tier: Tier; modelId: string }> = [
  { providerId: "anthropic", tier: "flagship", modelId: "claude-opus-4-5" },
  { providerId: "anthropic", tier: "balanced", modelId: "claude-sonnet-4-6" },
  { providerId: "anthropic", tier: "economy", modelId: "claude-haiku-4-5" },
  { providerId: "openai", tier: "flagship", modelId: "gpt-5" },
  { providerId: "openai", tier: "balanced", modelId: "gpt-5-mini" },
  { providerId: "openai", tier: "economy", modelId: "gpt-5-nano" },
  { providerId: "google", tier: "flagship", modelId: "gemini-2.5-pro" },
  { providerId: "google", tier: "balanced", modelId: "gemini-2.5-flash" },
  { providerId: "google", tier: "economy", modelId: "gemini-2.5-flash-lite" },
];

describe("BYOK_PRICING — catalog shape (3 providers × 3 tiers = 9 rows)", () => {
  test("has exactly 9 rows", () => {
    expect(BYOK_PRICING.length).toBe(9);
  });

  test("each provider appears exactly three times", () => {
    const counts = new Map<string, number>();
    for (const row of BYOK_PRICING) {
      counts.set(row.providerId, (counts.get(row.providerId) ?? 0) + 1);
    }
    expect(counts.get("anthropic")).toBe(3);
    expect(counts.get("openai")).toBe(3);
    expect(counts.get("google")).toBe(3);
  });

  test("each tier appears exactly three times", () => {
    const counts = new Map<string, number>();
    for (const row of BYOK_PRICING) {
      counts.set(row.tier, (counts.get(row.tier) ?? 0) + 1);
    }
    expect(counts.get("flagship")).toBe(3);
    expect(counts.get("balanced")).toBe(3);
    expect(counts.get("economy")).toBe(3);
  });

  for (const expected of REQUIRED_ROWS) {
    test(`includes ${expected.providerId} / ${expected.tier} / ${expected.modelId}`, () => {
      const row = BYOK_PRICING.find((r) => r.modelId === expected.modelId);
      expect(row).toBeDefined();
      expect(row?.providerId).toBe(expected.providerId);
      expect(row?.tier).toBe(expected.tier);
    });
  }

  test("every row has non-negative numeric prices and a non-empty vendor URL", () => {
    for (const row of BYOK_PRICING) {
      expect(typeof row.inputUsdPer1M).toBe("number");
      expect(row.inputUsdPer1M).toBeGreaterThanOrEqual(0);
      expect(typeof row.outputUsdPer1M).toBe("number");
      expect(row.outputUsdPer1M).toBeGreaterThanOrEqual(0);
      expect(typeof row.vendorPricingUrl).toBe("string");
      expect(row.vendorPricingUrl.length).toBeGreaterThan(0);
    }
  });
});

describe("getPricingForModel / isKnownModel — lookup helpers", () => {
  test("getPricingForModel('gpt-5-nano') returns the matching row", () => {
    const row = getPricingForModel("gpt-5-nano");
    expect(row).toBeDefined();
    expect(row?.modelId).toBe("gpt-5-nano");
    expect(row?.providerId).toBe("openai");
    expect(row?.tier).toBe("economy");
  });

  test("getPricingForModel('not-a-model') returns undefined", () => {
    expect(getPricingForModel("not-a-model")).toBeUndefined();
  });

  test("isKnownModel('not-a-model') returns false", () => {
    expect(isKnownModel("not-a-model")).toBe(false);
  });

  test("isKnownModel returns true for every catalog modelId", () => {
    for (const row of BYOK_PRICING) {
      expect(isKnownModel(row.modelId)).toBe(true);
    }
  });
});
