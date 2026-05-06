/**
 * anthropic.ts — Anthropic Provider Adapter.
 *
 * Validates a candidate Anthropic API key by sending a minimal
 * `/v1/messages` request (1-token output, cheapest model) and
 * translating HTTP status into a stable user-facing `errorKey`.
 *
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 * "Anthropic validation ping uses minimal messages request, 5s timeout".
 *
 * Tests inject a fake `fetch` and an optional shorter `timeoutMs` so
 * timeout behaviour can be exercised without 5-second waits.
 */

import type { ProviderAdapter, ValidationResult } from "./types";

interface AnthropicAdapterOptions {
  /** Override the request timeout. Production uses 5_000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const ANTHROPIC_VERSION = "2023-06-01";
const VALIDATION_MODEL = "claude-haiku-4-5";

/**
 * Map HTTP response status to the catalogued errorKey.
 * Per design: 401 → invalidKey, 402 → outOfCredits, 429 → rateLimited,
 * everything else (5xx / other 4xx / network / abort) → unreachable.
 */
function statusToErrorKey(status: number): string {
  switch (status) {
    case 401:
      return "errors.byok.invalidKey";
    case 402:
      return "errors.byok.outOfCredits";
    case 429:
      return "errors.byok.rateLimited";
    default:
      return "errors.byok.unreachable";
  }
}

export function createAnthropicAdapter(
  baseUrl: string,
  fetchImpl: typeof fetch,
  options: AnthropicAdapterOptions = {},
): ProviderAdapter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function validateKey(plaintext: string): Promise<ValidationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": plaintext,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: VALIDATION_MODEL,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: controller.signal,
      });

      if (res.ok) return { ok: true };
      return { ok: false, errorKey: statusToErrorKey(res.status) };
    } catch {
      // Network errors, AbortError on timeout, or anything else —
      // present as `unreachable` so callers don't need to distinguish.
      return { ok: false, errorKey: "errors.byok.unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return { validateKey };
}
