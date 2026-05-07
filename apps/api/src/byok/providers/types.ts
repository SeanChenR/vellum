/**
 * types.ts — ProviderAdapter strategy interface for BYOK validation.
 *
 * `ProviderId` is the 3-element literal union `'anthropic' | 'openai' |
 * 'google'`. The single source of truth lives in
 * `@vellum/shared/byok-pricing` (the shared package needs the same union
 * for the pricing catalog and preferences validator); this file
 * re-exports it so server code keeps importing from the local
 * `./types` module.
 *
 * Design ref: openspec/changes/add-byok-multi-provider-and-pricing/design.md
 *   "ProviderId becomes a 3-element union, exhaustiveness via
 *   Record<ProviderId, ProviderAdapter>".
 */

import type { ProviderId } from "@vellum/shared/byok-pricing";
export type { ProviderId };

export interface ValidationOk {
  ok: true;
}

export interface ValidationErr {
  ok: false;
  errorKey: string;
}

export type ValidationResult = ValidationOk | ValidationErr;

export interface ProviderAdapter {
  /**
   * Ping the provider with a candidate plaintext key. Returns
   * `{ ok: true }` when the vendor accepts the key (HTTP 200/201) or
   * `{ ok: false, errorKey }` with a translated error key for any
   * failure mode (auth / quota / rate limit / unreachable).
   *
   * MUST NOT throw for expected failure modes — those are returned as
   * `ValidationErr` so callers do not need a try/catch around every call.
   */
  validateKey(plaintext: string): Promise<ValidationResult>;
}
