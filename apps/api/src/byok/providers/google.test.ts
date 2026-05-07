/**
 * google.test.ts — unit tests for the Google Gemini Provider Adapter.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *   "Google Gemini key validation via vendor ping"
 *
 * Notable difference from OpenAI / Anthropic:
 *   - Auth is via query param `?key=<plaintext>`, NOT a header.
 *   - 400 / 401 / 403 all map to invalidKey (Google uses 403 for "key
 *     disabled / billing not enabled" while still meaning "fix your key").
 */

import { describe, expect, mock, test } from "bun:test";

import {
  abortableFetch,
  jsonResponse,
  networkErrorFetch,
  recordingFetch,
} from "../__fixtures__/vendor-stubs";
import { createGoogleAdapter } from "./google";

const BASE = "https://generativelanguage.googleapis.test";

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("googleAdapter — validateKey happy path", () => {
  test("HTTP 200 returns { ok: true }", async () => {
    const fetchImpl = mock(async () => jsonResponse(200, { models: [] }));
    const adapter = createGoogleAdapter(BASE, fetchImpl as unknown as typeof fetch);

    const result = await adapter.validateKey("AIza-good-key");

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("happy path GETs /v1beta/models with key as query param and no Authorization header", async () => {
    const { fetchImpl, calls } = recordingFetch(200);
    const adapter = createGoogleAdapter(BASE, fetchImpl);

    await adapter.validateKey("AIza-headers-probe");

    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    const parsed = new URL(c.url);
    expect(parsed.origin + parsed.pathname).toBe(`${BASE}/v1beta/models`);
    expect(parsed.searchParams.get("key")).toBe("AIza-headers-probe");
    expect(c.init.method ?? "GET").toBe("GET");
    const headers = new Headers(c.init.headers);
    expect(headers.get("authorization")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Status → errorKey mapping (table-driven, derived from spec example table)
// ---------------------------------------------------------------------------

describe("googleAdapter — status → errorKey mapping", () => {
  const cases: Array<{ status: number; errorKey: string; label: string }> = [
    { status: 400, errorKey: "errors.byok.invalidKey", label: "400 (Google: bad key)" },
    { status: 401, errorKey: "errors.byok.invalidKey", label: "401" },
    {
      status: 403,
      errorKey: "errors.byok.invalidKey",
      label: "403 (Google: disabled key / no billing)",
    },
    { status: 402, errorKey: "errors.byok.outOfCredits", label: "402" },
    { status: 429, errorKey: "errors.byok.rateLimited", label: "429" },
    { status: 500, errorKey: "errors.byok.unreachable", label: "500" },
    { status: 502, errorKey: "errors.byok.unreachable", label: "502" },
    { status: 503, errorKey: "errors.byok.unreachable", label: "503" },
    { status: 504, errorKey: "errors.byok.unreachable", label: "504" },
    { status: 404, errorKey: "errors.byok.unreachable", label: "other 4xx (404)" },
    { status: 422, errorKey: "errors.byok.unreachable", label: "other 4xx (422)" },
  ];

  for (const c of cases) {
    test(`${c.label} → ${c.errorKey}`, async () => {
      const fetchImpl = mock(async () => jsonResponse(c.status));
      const adapter = createGoogleAdapter(BASE, fetchImpl as unknown as typeof fetch);
      const result = await adapter.validateKey("AIza-status-probe");
      expect(result).toEqual({ ok: false, errorKey: c.errorKey });
    });
  }

  test("network error → errors.byok.unreachable", async () => {
    const adapter = createGoogleAdapter(BASE, networkErrorFetch());
    const result = await adapter.validateKey("AIza-network");
    expect(result).toEqual({ ok: false, errorKey: "errors.byok.unreachable" });
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("googleAdapter — 5s timeout", () => {
  test("AbortSignal aborts after timeout and returns errors.byok.unreachable", async () => {
    const adapter = createGoogleAdapter(BASE, abortableFetch(), { timeoutMs: 50 });

    const result = await adapter.validateKey("AIza-timeout-probe");
    expect(result).toEqual({ ok: false, errorKey: "errors.byok.unreachable" });
  });
});

// ---------------------------------------------------------------------------
// Base URL override
// ---------------------------------------------------------------------------

describe("googleAdapter — base URL override", () => {
  test("factory uses the supplied baseUrl, not a hardcoded vendor URL", async () => {
    const customBase = "https://google.proxy.local";
    const { fetchImpl, calls } = recordingFetch(200);
    const adapter = createGoogleAdapter(customBase, fetchImpl);

    await adapter.validateKey("AIza-baseurl");

    expect(calls).toHaveLength(1);
    const parsed = new URL(calls[0]!.url);
    expect(parsed.origin + parsed.pathname).toBe(`${customBase}/v1beta/models`);
  });
});
