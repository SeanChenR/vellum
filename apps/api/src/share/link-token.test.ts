/**
 * Link token tests (task 2.3).
 *
 * Covers the token utility used by:
 *   - "Owner toggles the public link mode"
 *   - "Owner rotates the public link token"
 *
 * Same shape constraints as `invite-token` — 32 bytes base64url — but kept
 * as its own module so future divergence (e.g., longer tokens for higher-
 * entropy public links) does not require touching invite logic.
 */

import { describe, expect, test } from "bun:test";
import { generateLinkToken } from "./link-token";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;

describe("generateLinkToken", () => {
  test("produces a base64url string of 43 characters (32 bytes)", () => {
    const token = generateLinkToken();
    expect(token).toMatch(URL_SAFE);
    expect(token.length).toBe(43);
  });

  test("returns a different token on each call", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) {
      seen.add(generateLinkToken());
    }
    expect(seen.size).toBe(64);
  });

  test("rotate scenario: previous and rotated tokens differ", () => {
    // Rotation is just `generateLinkToken` called again; we verify entropy
    // does not produce identical neighbours (probability of collision is
    // negligible at 32 bytes).
    const previous = generateLinkToken();
    const rotated = generateLinkToken();
    expect(previous).not.toBe(rotated);
  });

  test("token never contains URL-unsafe characters '+', '/', or '='", () => {
    for (let i = 0; i < 32; i++) {
      const t = generateLinkToken();
      expect(t.includes("+")).toBe(false);
      expect(t.includes("/")).toBe(false);
      expect(t.includes("=")).toBe(false);
    }
  });
});
