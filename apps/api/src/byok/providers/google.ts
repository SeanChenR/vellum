/**
 * google.ts — Google Gemini Provider Adapter.
 *
 * Validates a candidate Gemini API key by calling `models.list` (a
 * lightweight GET that does not consume generation quota) and
 * translating HTTP status into a stable user-facing `errorKey`.
 *
 * Design ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/design.md
 *   "Google adapter — query-param auth, Gemini models.list ping"
 *
 * Notable difference from Anthropic / OpenAI:
 *   - Auth is query param `?key=<plaintext>`, not a header. Google
 *     accepts neither `Authorization` nor `x-api-key` for API keys.
 *   - 400 / 401 / 403 all map to invalidKey: Google uses 403 for
 *     "key disabled" / "billing not enabled", which from the user's
 *     perspective still means "fix your key / billing".
 */

import type { ProviderAdapter, ValidationResult } from "./types";

interface GoogleAdapterOptions {
  /** Override the request timeout. Production uses 5_000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Map HTTP response status to the catalogued errorKey.
 *
 * Per spec example table:
 *   400 / 401 / 403 → invalidKey  (Google specific: 400/403 also bad-key)
 *   402 → outOfCredits
 *   429 → rateLimited
 *   5xx → unreachable
 *   other 4xx (404 / 422 / etc.) → unreachable
 *   network / timeout → unreachable
 */
function statusToErrorKey(status: number): string {
  switch (status) {
    case 400:
    case 401:
    case 403:
      return "errors.byok.invalidKey";
    case 402:
      return "errors.byok.outOfCredits";
    case 429:
      return "errors.byok.rateLimited";
    default:
      return "errors.byok.unreachable";
  }
}

export function createGoogleAdapter(
  baseUrl: string,
  fetchImpl: typeof fetch,
  options: GoogleAdapterOptions = {},
): ProviderAdapter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function validateKey(plaintext: string): Promise<ValidationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = new URL(`${baseUrl}/v1beta/models`);
      url.searchParams.set("key", plaintext);

      const res = await fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });

      if (res.ok) return { ok: true };
      return { ok: false, errorKey: statusToErrorKey(res.status) };
    } catch {
      return { ok: false, errorKey: "errors.byok.unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return { validateKey };
}
