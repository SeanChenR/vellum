/**
 * providers/index.test.ts — adapter registry exhaustiveness.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *   "Provider Adapter strategy interface" — registry MUST contain an
 *   adapter for every member of the ProviderId union, enforced by the
 *   `Record<ProviderId, ProviderAdapter>` return type at compile time.
 *
 * Runtime tests verify the contract holds: all three keys exist and each
 * exposes a `validateKey` method. Compile-time enforcement is exercised
 * by the `satisfies` annotation in production code (`./index.ts`).
 */

import { describe, expect, test } from "bun:test";

import { createProviderAdapters } from "./index";
import type { ProviderId } from "./types";

describe("createProviderAdapters — three-provider registry", () => {
  test("returns an adapter for each of anthropic / openai / google", () => {
    const adapters = createProviderAdapters({});

    const expected: ProviderId[] = ["anthropic", "openai", "google"];
    for (const id of expected) {
      expect(adapters[id]).toBeDefined();
      expect(typeof adapters[id].validateKey).toBe("function");
    }
  });

  test("registry has exactly three keys (no extras, none missing)", () => {
    const adapters = createProviderAdapters({});
    const keys = Object.keys(adapters).sort();
    expect(keys).toEqual(["anthropic", "google", "openai"]);
  });
});
