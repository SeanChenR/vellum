/**
 * vault.ts — API Key Vault (M11.1).
 *
 * AES-256-GCM authenticated encryption for per-user, per-provider API
 * keys stored in the `api_keys` table. Caller hands plaintext in,
 * receives an opaque packed string `base64(iv ‖ tag ‖ ciphertext)` —
 * never sees raw bytes.
 *
 * Master key sourced from `Bun.env.API_KEY_ENCRYPTION_KEY` at process
 * boot via `initVault(envValue)`. Fail-fast: missing / non-hex / wrong-
 * length keys throw at init time so the server cannot start with broken
 * crypto.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 *   - Encrypted storage of provider API keys
 *   - AES-256-GCM API Key Vault
 *   - Master key sourced from environment with startup validation
 * Design ref: openspec/changes/add-byok-anthropic/design.md decisions
 *   - "AES-256-GCM via node:crypto, packed as base64(iv ‖ tag ‖ ciphertext)"
 *   - "Master key from Bun.env.API_KEY_ENCRYPTION_KEY, fail-fast on startup"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // GCM standard nonce length (NIST SP 800-38D)
const TAG_LENGTH_BYTES = 16;
const HEX_KEY_LENGTH = KEY_LENGTH_BYTES * 2;

export interface Vault {
  encryptApiKey(plaintext: string): string;
  decryptApiKey(packed: string): string;
}

/**
 * Initialise the vault from a hex-encoded master key.
 *
 * @throws Error  when `envValue` is missing, non-hex, or decodes to a
 *                length other than 32 bytes — by design, so a misconfigured
 *                process cannot start.
 */
export function initVault(envValue: string | undefined): Vault {
  if (!envValue) {
    throw new Error("API_KEY_ENCRYPTION_KEY is required and must be 32 bytes hex (64 hex chars)");
  }
  if (envValue.length !== HEX_KEY_LENGTH || !/^[0-9a-fA-F]+$/.test(envValue)) {
    throw new Error(
      `API_KEY_ENCRYPTION_KEY must be exactly ${HEX_KEY_LENGTH} hex chars (got ${envValue.length})`,
    );
  }

  const key = Buffer.from(envValue, "hex");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `API_KEY_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes (got ${key.length})`,
    );
  }

  function encryptApiKey(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
  }

  function decryptApiKey(packed: string): string {
    const buf = Buffer.from(packed, "base64");
    if (buf.length < IV_LENGTH_BYTES + TAG_LENGTH_BYTES + 1) {
      throw new Error("packed key is shorter than the minimum AES-GCM frame");
    }
    const iv = buf.subarray(0, IV_LENGTH_BYTES);
    const tag = buf.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + TAG_LENGTH_BYTES);
    const ciphertext = buf.subarray(IV_LENGTH_BYTES + TAG_LENGTH_BYTES);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  return { encryptApiKey, decryptApiKey };
}
