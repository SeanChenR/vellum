/**
 * token-format.ts — Personal Access Token plaintext generation, hashing,
 * and prefix extraction.
 *
 * Format contract (spec personal-access-token "Personal access tokens
 * are persisted as opaque hashed entries per user"):
 *   - Plaintext: `vlm_pat_` + 32 base62 chars (total 40 chars)
 *   - Stored hash: SHA-256 hex lowercase (64 chars)
 *   - Prefix shown in UI / scanned by secret-scanners: first 12 chars
 *
 * The `vlm_pat_` prefix is the marker GitHub Secret Scanning,
 * TruffleHog, and similar tools use to identify leaked Vellum tokens.
 * Do NOT change the prefix without coordinated update to scanner
 * patterns.
 */

import { createHash, randomBytes } from "node:crypto";

/** Canonical prefix on every Vellum PAT plaintext. */
export const PAT_PLAINTEXT_PREFIX = "vlm_pat_";

/** Number of base62 characters after the prefix. 32 chars → 62^32 ≈ 2.27e57 keyspace. */
const PAT_RANDOM_LENGTH = 32;

/** Length of the substring stored in `token_prefix` for UI / scanner. */
export const PAT_DISPLAY_PREFIX_LENGTH = 12;

const BASE62_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a fresh PAT plaintext. Uses crypto.randomBytes (CSPRNG) +
 * rejection sampling so the resulting characters are uniformly
 * distributed over the 62-char alphabet (avoids the modulo bias that a
 * naive `bytes[i] % 62` would introduce).
 */
export function generateTokenPlaintext(): string {
  const out = Array.from<string>({ length: PAT_RANDOM_LENGTH });
  let written = 0;
  // The largest multiple of 62 ≤ 256 is 248. Any byte ≥ 248 is rejected
  // to keep the distribution uniform over 0..61.
  const acceptCeiling = 248;
  while (written < PAT_RANDOM_LENGTH) {
    const buf = randomBytes(PAT_RANDOM_LENGTH - written + 8);
    for (let i = 0; i < buf.length && written < PAT_RANDOM_LENGTH; i++) {
      const byte = buf[i]!;
      if (byte < acceptCeiling) {
        out[written++] = BASE62_ALPHABET[byte % 62]!;
      }
    }
  }
  return PAT_PLAINTEXT_PREFIX + out.join("");
}

/** SHA-256 hex (lowercase, 64 chars) of the supplied plaintext token. */
export function hashTokenPlaintext(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** First 12 chars of the plaintext (e.g. `"vlm_pat_a3f2"`) for UI / scanner. */
export function extractTokenPrefix(plaintext: string): string {
  return plaintext.slice(0, PAT_DISPLAY_PREFIX_LENGTH);
}
