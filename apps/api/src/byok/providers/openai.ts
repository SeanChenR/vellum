/**
 * openai.ts — OpenAI Provider Adapter.
 *
 * Validates a candidate OpenAI API key by sending a single
 * `/v1/chat/completions` request with the cheapest economy-tier model
 * (`gpt-5-nano`, max_tokens=1) and translating HTTP status into a
 * stable user-facing `errorKey`.
 *
 * Design ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/design.md
 *   "OpenAI adapter — Bearer auth, /v1/chat/completions ping with gpt-5-nano"
 *
 * Tests inject a fake `fetch` and an optional shorter `timeoutMs` so
 * timeout behaviour can be exercised without 5-second waits.
 */

import type { ProviderAdapter, ValidationResult } from "./types";

interface OpenAIAdapterOptions {
  /** Override the request timeout. Production uses 5_000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const VALIDATION_MODEL = "gpt-5-nano";

/**
 * Map HTTP response status to the catalogued errorKey.
 *
 * Per spec example table:
 *   401 → invalidKey
 *   402 → outOfCredits
 *   429 → rateLimited
 *   500/502/503/504 → unreachable
 *   other 4xx (400/403/404/422) → unreachable
 *   network / timeout → unreachable
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

export function createOpenAIAdapter(
  baseUrl: string,
  fetchImpl: typeof fetch,
  options: OpenAIAdapterOptions = {},
): ProviderAdapter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function validateKey(plaintext: string): Promise<ValidationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${plaintext}`,
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
      // Network errors, AbortError on timeout, anything else — present as
      // `unreachable` so callers don't need to distinguish.
      return { ok: false, errorKey: "errors.byok.unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return { validateKey };
}
