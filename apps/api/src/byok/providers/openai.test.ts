/**
 * openai.test.ts — unit tests for the OpenAI Provider Adapter.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *   "OpenAI key validation via vendor ping"
 *
 * Mirror of the Anthropic test pattern — fetch is injected at factory
 * time so the test never hits the real OpenAI API. Uses shared stubs
 * from `__fixtures__/vendor-stubs.ts`.
 */

import { describe, expect, mock, test } from "bun:test";

import {
  abortableFetch,
  jsonResponse,
  networkErrorFetch,
  recordingFetch,
} from "../__fixtures__/vendor-stubs";
import { createOpenAIAdapter } from "./openai";

const BASE = "https://api.openai.test";

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("openaiAdapter — validateKey happy path", () => {
  test("HTTP 200 returns { ok: true }", async () => {
    const fetchImpl = mock(async () => jsonResponse(200, { id: "chatcmpl-x" }));
    const adapter = createOpenAIAdapter(BASE, fetchImpl as unknown as typeof fetch);

    const result = await adapter.validateKey("sk-proj-good-key");

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("HTTP 201 also returns { ok: true }", async () => {
    const fetchImpl = mock(async () => jsonResponse(201));
    const adapter = createOpenAIAdapter(BASE, fetchImpl as unknown as typeof fetch);

    expect(await adapter.validateKey("sk-proj-201")).toEqual({ ok: true });
  });

  test("happy path POSTs to /v1/chat/completions with Bearer auth and gpt-5-nano body", async () => {
    const { fetchImpl, calls } = recordingFetch(200);
    const adapter = createOpenAIAdapter(BASE, fetchImpl);

    await adapter.validateKey("sk-proj-headers-probe");

    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toBe(`${BASE}/v1/chat/completions`);
    expect(c.init.method).toBe("POST");
    const headers = new Headers(c.init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-proj-headers-probe");
    expect(headers.get("x-api-key")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
    const body = JSON.parse((c.init.body as string) ?? "{}");
    expect(body.model).toBe("gpt-5-nano");
    expect(body.max_tokens).toBe(1);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});

// ---------------------------------------------------------------------------
// Status → errorKey mapping (table-driven, derived from spec example table)
// ---------------------------------------------------------------------------

describe("openaiAdapter — status → errorKey mapping", () => {
  const cases: Array<{ status: number; errorKey: string; label: string }> = [
    { status: 401, errorKey: "errors.byok.invalidKey", label: "401" },
    { status: 402, errorKey: "errors.byok.outOfCredits", label: "402" },
    { status: 429, errorKey: "errors.byok.rateLimited", label: "429" },
    { status: 500, errorKey: "errors.byok.unreachable", label: "500" },
    { status: 502, errorKey: "errors.byok.unreachable", label: "502" },
    { status: 503, errorKey: "errors.byok.unreachable", label: "503" },
    { status: 504, errorKey: "errors.byok.unreachable", label: "504" },
    { status: 400, errorKey: "errors.byok.unreachable", label: "other 4xx (400)" },
    { status: 403, errorKey: "errors.byok.unreachable", label: "other 4xx (403)" },
    { status: 404, errorKey: "errors.byok.unreachable", label: "other 4xx (404)" },
    { status: 422, errorKey: "errors.byok.unreachable", label: "other 4xx (422)" },
  ];

  for (const c of cases) {
    test(`${c.label} → ${c.errorKey}`, async () => {
      const fetchImpl = mock(async () => jsonResponse(c.status));
      const adapter = createOpenAIAdapter(BASE, fetchImpl as unknown as typeof fetch);
      const result = await adapter.validateKey("sk-proj-status-probe");
      expect(result).toEqual({ ok: false, errorKey: c.errorKey });
    });
  }

  test("network error → errors.byok.unreachable", async () => {
    const adapter = createOpenAIAdapter(BASE, networkErrorFetch());
    const result = await adapter.validateKey("sk-proj-network");
    expect(result).toEqual({ ok: false, errorKey: "errors.byok.unreachable" });
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("openaiAdapter — 5s timeout", () => {
  test("AbortSignal aborts after timeout and returns errors.byok.unreachable", async () => {
    const adapter = createOpenAIAdapter(BASE, abortableFetch(), { timeoutMs: 50 });

    const result = await adapter.validateKey("sk-proj-timeout-probe");
    expect(result).toEqual({ ok: false, errorKey: "errors.byok.unreachable" });
  });
});

// ---------------------------------------------------------------------------
// Base URL override
// ---------------------------------------------------------------------------

describe("openaiAdapter — base URL override", () => {
  test("factory uses the supplied baseUrl, not a hardcoded vendor URL", async () => {
    const customBase = "https://openai.proxy.local";
    const { fetchImpl, calls } = recordingFetch(200);
    const adapter = createOpenAIAdapter(customBase, fetchImpl);

    await adapter.validateKey("sk-proj-baseurl");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${customBase}/v1/chat/completions`);
  });
});
