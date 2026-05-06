/**
 * byok-validator.test.ts — Zod validator unit tests.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 */

import { describe, expect, test } from "bun:test";
import { byokSaveBodySchema, byokProviderParamSchema } from "./byok-validator";

describe("byokSaveBodySchema", () => {
  test("rejects empty apiKey", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: "" });
    expect(r.success).toBe(false);
  });

  test("rejects apiKey shorter than 8 chars", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: "abc" });
    expect(r.success).toBe(false);
  });

  test("rejects apiKey longer than 512 chars", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: "a".repeat(513) });
    expect(r.success).toBe(false);
  });

  test("rejects non-string apiKey", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: 12345 });
    expect(r.success).toBe(false);
  });

  test("rejects missing apiKey", () => {
    const r = byokSaveBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  test("accepts apiKey with 8 chars (boundary)", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: "12345678" });
    expect(r.success).toBe(true);
  });

  test("accepts apiKey with 512 chars (boundary)", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: "a".repeat(512) });
    expect(r.success).toBe(true);
  });

  test("accepts realistic anthropic-style key", () => {
    const r = byokSaveBodySchema.safeParse({ apiKey: "sk-ant-api03-abcdef0123456789" });
    expect(r.success).toBe(true);
  });
});

describe("byokProviderParamSchema", () => {
  test("accepts 'anthropic'", () => {
    expect(byokProviderParamSchema.safeParse("anthropic").success).toBe(true);
  });

  test("rejects 'openai' (M11.2 territory; not yet enabled)", () => {
    expect(byokProviderParamSchema.safeParse("openai").success).toBe(false);
  });

  test("rejects 'google' (M11.2 territory; not yet enabled)", () => {
    expect(byokProviderParamSchema.safeParse("google").success).toBe(false);
  });

  test("rejects unknown provider", () => {
    expect(byokProviderParamSchema.safeParse("unknown").success).toBe(false);
  });

  test("rejects empty string", () => {
    expect(byokProviderParamSchema.safeParse("").success).toBe(false);
  });

  test("rejects non-string", () => {
    expect(byokProviderParamSchema.safeParse(123).success).toBe(false);
  });
});
