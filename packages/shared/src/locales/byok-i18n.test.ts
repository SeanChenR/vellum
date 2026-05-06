/**
 * byok-i18n.test.ts — locale parity assertions for the BYOK key tree.
 *
 * Mirrors the i18n-audit pattern: the `errors.byok.*` and
 * `account.apiKeys.*` subtrees in zh-TW.json and en.json MUST have an
 * identical key set. Drift in either direction is a translation bug.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 *   "BYOK i18n catalog populated for both supported locales"
 */

import { describe, expect, test } from "bun:test";
import en from "./en.json";
import zhTW from "./zh-TW.json";

type Tree = Record<string, unknown>;

function flatten(prefix: string, node: unknown, out: Set<string>): void {
  if (node === null || typeof node !== "object") {
    out.add(prefix);
    return;
  }
  for (const [k, v] of Object.entries(node as Tree)) {
    flatten(prefix ? `${prefix}.${k}` : k, v, out);
  }
}

function subtree(root: Tree, dottedPath: string): unknown {
  return dottedPath
    .split(".")
    .reduce<unknown>(
      (n, key) => (n && typeof n === "object" && key in (n as Tree) ? (n as Tree)[key] : undefined),
      root,
    );
}

function flatKeysAt(root: Tree, dottedPath: string): Set<string> {
  const node = subtree(root, dottedPath);
  if (node === undefined) return new Set();
  const out = new Set<string>();
  flatten("", node, out);
  return out;
}

describe("BYOK i18n parity (en vs zh-TW)", () => {
  test("errors.byok.* has identical key set in both locales", () => {
    const enKeys = flatKeysAt(en as unknown as Tree, "errors.byok");
    const zhKeys = flatKeysAt(zhTW as unknown as Tree, "errors.byok");
    expect(enKeys.size).toBeGreaterThan(0);
    expect([...enKeys].sort()).toEqual([...zhKeys].sort());
  });

  test("account.apiKeys.* has identical key set in both locales", () => {
    const enKeys = flatKeysAt(en as unknown as Tree, "account.apiKeys");
    const zhKeys = flatKeysAt(zhTW as unknown as Tree, "account.apiKeys");
    expect(enKeys.size).toBeGreaterThan(0);
    expect([...enKeys].sort()).toEqual([...zhKeys].sort());
  });

  test("errors.byok contains every documented key from the design", () => {
    const enKeys = flatKeysAt(en as unknown as Tree, "errors.byok");
    for (const k of [
      "invalidKey",
      "outOfCredits",
      "rateLimited",
      "unreachable",
      "providerUnknown",
      "notAuthenticated",
    ]) {
      expect(enKeys.has(k)).toBe(true);
    }
  });

  test("account.apiKeys contains the documented UI key tree", () => {
    const enKeys = flatKeysAt(en as unknown as Tree, "account.apiKeys");
    for (const k of [
      "title",
      "subtitle",
      "providers.anthropic.label",
      "providers.anthropic.placeholder",
      "providers.anthropic.helpUrl",
      "actions.save",
      "actions.delete",
      "actions.replace",
      "status.saving",
      "status.saved",
      "confirm.deleteTitle",
      "confirm.deleteBody",
    ]) {
      expect(enKeys.has(k)).toBe(true);
    }
  });
});
