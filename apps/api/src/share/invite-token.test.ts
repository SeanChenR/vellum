/**
 * Invite token tests (task 2.2).
 *
 * Covers the token utility used by:
 *   - "Owner invites an unknown email creates a pending invite and sends mail"
 *   - "Invite acceptance route requires email match and writes a share"
 *
 * The token must be 32 bytes of crypto-random base64url-encoded data with
 * deterministic length and a fully URL-safe charset.
 */

import { describe, expect, test } from "bun:test";
import { generateInviteToken, computeInviteExpiresAt } from "./invite-token";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;

describe("generateInviteToken", () => {
  test("produces a base64url string of 43 characters (32 bytes)", () => {
    const token = generateInviteToken();
    expect(token).toMatch(URL_SAFE);
    // 32 bytes → ceil(32/3)*4 = 44 chars with padding, base64url drops the `=`
    // → 43 characters of [A-Za-z0-9_-]
    expect(token.length).toBe(43);
  });

  test("returns a different token on each call (sanity for randomness)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) {
      seen.add(generateInviteToken());
    }
    expect(seen.size).toBe(64);
  });

  test("token never contains URL-unsafe characters '+', '/', or '='", () => {
    for (let i = 0; i < 32; i++) {
      const t = generateInviteToken();
      expect(t.includes("+")).toBe(false);
      expect(t.includes("/")).toBe(false);
      expect(t.includes("=")).toBe(false);
    }
  });
});

describe("computeInviteExpiresAt", () => {
  test("returns 7 days after the supplied creation time", () => {
    const created = new Date("2026-05-02T12:00:00Z");
    const expires = computeInviteExpiresAt(created);
    const expected = new Date("2026-05-09T12:00:00Z");
    expect(expires.getTime()).toBe(expected.getTime());
  });

  test("does not mutate the input date", () => {
    const created = new Date("2026-05-02T12:00:00Z");
    const before = created.getTime();
    computeInviteExpiresAt(created);
    expect(created.getTime()).toBe(before);
  });
});
