/**
 * types.ts — ProviderAdapter strategy interface for BYOK validation.
 *
 * M11.1 implements only the `anthropic` variant. M11.2 will extend
 * `ProviderId` to include `'openai' | 'google'`; new providers register
 * a sibling adapter file and add an entry to the `adapters` record in
 * `./index.ts` — `routes.ts` is unchanged.
 *
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 * "ProviderAdapter strategy interface; one file per provider".
 */

/** Provider identifier — extend in M11.2 to `'anthropic' | 'openai' | 'google'`. */
export type ProviderId = "anthropic";

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
