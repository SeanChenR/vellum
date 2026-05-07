/**
 * preferences-validator.test.ts — zod schema for PATCH preferences body.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *   "PATCH preferences endpoint validates against pricing catalog"
 *
 * The validator MUST reject:
 *   - unknown providers (not in `'anthropic' | 'openai' | 'google'`)
 *   - unknown models (not in BYOK_PRICING)
 *   - missing fields
 * It MUST accept any (provider, model) pair where the model exists in
 * the pricing catalog. Note: it does NOT enforce that `provider` matches
 * the model's actual provider — that pairing rule isn't in the spec
 * (the catalog lookup ignores provider). Spec scenario:
 *
 *   PATCHes { provider: "openai", model: "gpt-9000" } → 400 invalidPreference
 *
 * implies model membership is enough; pairing is a UI concern.
 */

import { describe, expect, test } from "bun:test";

import { byokPreferencesBodySchema } from "./preferences-validator";

describe("byokPreferencesBodySchema — happy path", () => {
  test("accepts (anthropic, claude-haiku-4-5)", () => {
    const r = byokPreferencesBodySchema.safeParse({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });
    expect(r.success).toBe(true);
  });

  test("accepts (openai, gpt-5-nano)", () => {
    const r = byokPreferencesBodySchema.safeParse({
      provider: "openai",
      model: "gpt-5-nano",
    });
    expect(r.success).toBe(true);
  });

  test("accepts (google, gemini-2.5-flash-lite)", () => {
    const r = byokPreferencesBodySchema.safeParse({
      provider: "google",
      model: "gemini-2.5-flash-lite",
    });
    expect(r.success).toBe(true);
  });
});

describe("byokPreferencesBodySchema — rejection paths", () => {
  test("rejects unknown provider", () => {
    const r = byokPreferencesBodySchema.safeParse({
      provider: "cohere",
      model: "command",
    });
    expect(r.success).toBe(false);
  });

  test("rejects unknown model id (catalog miss)", () => {
    const r = byokPreferencesBodySchema.safeParse({
      provider: "openai",
      model: "gpt-9000",
    });
    expect(r.success).toBe(false);
  });

  test("rejects missing provider", () => {
    const r = byokPreferencesBodySchema.safeParse({ model: "gpt-5-nano" });
    expect(r.success).toBe(false);
  });

  test("rejects missing model", () => {
    const r = byokPreferencesBodySchema.safeParse({ provider: "openai" });
    expect(r.success).toBe(false);
  });

  test("rejects empty body", () => {
    const r = byokPreferencesBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  test("rejects non-string provider", () => {
    const r = byokPreferencesBodySchema.safeParse({ provider: 1, model: "gpt-5-nano" });
    expect(r.success).toBe(false);
  });

  test("rejects non-string model", () => {
    const r = byokPreferencesBodySchema.safeParse({ provider: "openai", model: 42 });
    expect(r.success).toBe(false);
  });
});
