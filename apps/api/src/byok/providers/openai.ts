/**
 * openai.ts — OpenAI Provider Adapter.
 *
 * Validates a candidate OpenAI API key by sending a single GET request
 * to `/v1/models` (token-free, payload-free) and translating HTTP
 * status into a stable user-facing `errorKey`.
 *
 * Endpoint shape note: list-models is used INSTEAD OF
 * `/v1/chat/completions`. The original M11 design picked chat-completions
 * with `model: gpt-5-nano, max_tokens: 1`, but reasoning-style models
 * reserve internal thinking-token budget BEFORE emitting any response
 * token. With cap=1 OpenAI returns HTTP 400 (`max_tokens` reached or
 * `unsupported_parameter` for older field name), and the validator
 * surfaces `errors.byok.unreachable` to the user even though the key
 * is valid. Renaming the field to `max_completion_tokens` did not
 * help — the cap itself was the wall. Switching to GET /v1/models
 * sidesteps thinking-token economics entirely and matches the Google
 * adapter's authentication-only ping pattern.
 *
 * Spec ref:
 *   openspec/specs/byok-keys/spec.md
 *   "OpenAI key validation via vendor ping" (after add-agent-runtime-streaming).
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
      const res = await fetchImpl(`${baseUrl}/v1/models`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${plaintext}`,
        },
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
