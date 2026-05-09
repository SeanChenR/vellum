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

  test("happy path GETs /v1/models with Bearer auth and no body", async () => {
    // Spec: openspec/specs/byok-keys/spec.md
    //   "OpenAI key validation via vendor ping" >
    //   "Validation request is GET with no body".
    //
    // Rationale (see spec body): chat-completions ping was incompatible
    // with reasoning-style validation models (gpt-5-nano) which reserve
    // thinking-token budget before emitting any response token. Switched
    // to GET /v1/models — token-free, payload-free, same auth shape.
    const { fetchImpl, calls } = recordingFetch(200);
    const adapter = createOpenAIAdapter(BASE, fetchImpl);

    await adapter.validateKey("sk-proj-headers-probe");

    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toBe(`${BASE}/v1/models`);
    expect(c.init.method).toBe("GET");
    const headers = new Headers(c.init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-proj-headers-probe");
    expect(headers.get("x-api-key")).toBeNull();
    // No body, no content-type — list-models is a pure GET.
    expect(c.init.body).toBeFalsy();
  });

  test("validation request carries no chat-completions body fields", async () => {
    // Spec: openspec/specs/byok-keys/spec.md
    //   "OpenAI key validation via vendor ping" >
    //   "Validation request is GET with no body".
    //
    // Negative assertion guarding against regression to chat/completions
    // shape: the body MUST NOT contain model / messages / max_tokens /
    // max_completion_tokens because /v1/models does not accept them.
    const { fetchImpl, calls } = recordingFetch(200);
    const adapter = createOpenAIAdapter(BASE, fetchImpl);

    await adapter.validateKey("sk-proj-no-body-fields");

    expect(calls).toHaveLength(1);
    const raw = calls[0]!.init.body;
    if (raw) {
      // If a body was inadvertently set, none of these fields may exist.
      const body = JSON.parse(raw as string);
      expect(body).not.toHaveProperty("model");
      expect(body).not.toHaveProperty("messages");
      expect(body).not.toHaveProperty("max_tokens");
      expect(body).not.toHaveProperty("max_completion_tokens");
    }
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
    expect(calls[0]?.url).toBe(`${customBase}/v1/models`);
  });
});
