/**
 * vendor-stubs.ts — shared fetch stubs for BYOK provider adapter tests.
 *
 * Three adapters (anthropic / openai / google) all exercise the same
 * status → errorKey table plus network / timeout behaviour. Centralising
 * the stub helpers keeps the per-adapter test files focused on what's
 * provider-specific (URL shape, auth header / query, body format) instead
 * of re-deriving the same Response factories.
 *
 * Existing `anthropic.test.ts` from M11.1 inlines its own helpers — we
 * leave it as-is rather than retrofit working code; openai.test.ts and
 * google.test.ts use these helpers from day one.
 */

/** Build a JSON response with a given status. Body defaults to `{}`. */
export function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Build a fetch stub that resolves to a fixed-status JSON response and
 * records every call's url + init for later assertions.
 */
export function recordingFetch(
  status: number,
  body: unknown = {},
): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return jsonResponse(status, body);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

/** Build a fetch stub that throws a network-style TypeError on every call. */
export function networkErrorFetch(message = "network down"): typeof fetch {
  return (async () => {
    throw new TypeError(message);
  }) as unknown as typeof fetch;
}

/**
 * Build a fetch stub that never resolves on its own — it only completes
 * when the caller's AbortSignal fires (rejecting with AbortError).
 *
 * Use with adapter `timeoutMs: 50` (or similar) so the abort wins the race
 * without making the test wait the production 5 seconds.
 */
export function abortableFetch(): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    return await new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          const err: Error & { name: string } = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }
    });
  }) as unknown as typeof fetch;
}
