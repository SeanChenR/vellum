/**
 * token-format.test.ts — PAT plaintext generation, hashing, and prefix
 * extraction.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   "Personal access tokens are persisted as opaque hashed entries per user"
 *
 * Format: `vlm_pat_<32 char base62>` total 40 chars.
 * Hash:   SHA-256 hex (64 lowercase chars).
 * Prefix: first 12 chars of the plaintext (e.g. "vlm_pat_a3f2").
 */

import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  extractTokenPrefix,
  generateTokenPlaintext,
  hashTokenPlaintext,
  PAT_PLAINTEXT_PREFIX,
} from "./token-format";

describe("generateTokenPlaintext", () => {
  test("returns a string of exactly 40 characters", () => {
    const t = generateTokenPlaintext();
    expect(t).toHaveLength(40);
  });

  test("starts with the canonical 'vlm_pat_' prefix", () => {
    const t = generateTokenPlaintext();
    expect(t.startsWith(PAT_PLAINTEXT_PREFIX)).toBe(true);
    expect(PAT_PLAINTEXT_PREFIX).toBe("vlm_pat_");
  });

  test("body after prefix is 32 base62 chars (A-Z, a-z, 0-9)", () => {
    const t = generateTokenPlaintext();
    const body = t.slice(PAT_PLAINTEXT_PREFIX.length);
    expect(body).toHaveLength(32);
    expect(body).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  test("returns a different token each invocation (entropy)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateTokenPlaintext());
    }
    expect(tokens.size).toBe(100);
  });
});

describe("hashTokenPlaintext", () => {
  test("returns a 64-char lowercase hex SHA-256 string", () => {
    const h = hashTokenPlaintext("vlm_pat_abcDEF1234567890ghijklmnopqrstuvwx");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test("matches node:crypto SHA-256 reference", () => {
    const sample = "vlm_pat_test1234test1234test1234test1234";
    const reference = createHash("sha256").update(sample).digest("hex");
    expect(hashTokenPlaintext(sample)).toBe(reference);
  });

  test("is deterministic — same input yields same hash", () => {
    const sample = "vlm_pat_K9mPq3vWxN2fT4hY8jZc1bR5sLgD7eAu";
    expect(hashTokenPlaintext(sample)).toBe(hashTokenPlaintext(sample));
  });

  test("different inputs yield different hashes", () => {
    expect(hashTokenPlaintext("a")).not.toBe(hashTokenPlaintext("b"));
  });
});

describe("extractTokenPrefix", () => {
  test("returns the first 12 characters of the plaintext", () => {
    const t = "vlm_pat_a3f2KLm9XnY2pQrStUvWxZ4cDgHj";
    expect(extractTokenPrefix(t)).toBe("vlm_pat_a3f2");
    expect(extractTokenPrefix(t)).toHaveLength(12);
  });

  test("does not leak any character beyond the 12-char window", () => {
    const t = generateTokenPlaintext();
    const prefix = extractTokenPrefix(t);
    expect(prefix).toBe(t.slice(0, 12));
    expect(prefix.length).toBe(12);
  });
});
