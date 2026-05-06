/**
 * anthropic.test.ts — unit tests for the Anthropic Provider Adapter.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 * Design ref: openspec/changes/add-byok-anthropic/design.md
 *   - "ProviderAdapter strategy interface; one file per provider"
 *   - "Anthropic validation ping uses minimal messages request, 5s timeout"
 *
 * The adapter is exercised against a mocked `fetch` injected at factory
 * time so the test never hits the real Anthropic API.
 */

import { describe, expect, mock, test } from "bun:test";
import { createAnthropicAdapter } from "./anthropic";

const BASE = "https://api.anthropic.test";

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// 4.1 happy path
// ---------------------------------------------------------------------------

describe("anthropicAdapter — validateKey happy path", () => {
  test("HTTP 200 returns { ok: true }", async () => {
    const fetchImpl = mock(async () => jsonResponse(200, { content: [] }));
    const adapter = createAnthropicAdapter(BASE, fetchImpl as unknown as typeof fetch);

    const result = await adapter.validateKey("sk-ant-good-key");

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("happy path POSTs to /v1/messages with x-api-key + anthropic-version headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = mock(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse(200);
    });
    const adapter = createAnthropicAdapter(BASE, fetchImpl as unknown as typeof fetch);

    await adapter.validateKey("sk-ant-headers-probe");

    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toBe(`${BASE}/v1/messages`);
    expect(c.init.method).toBe("POST");
    const headers = new Headers(c.init.headers);
    expect(headers.get("x-api-key")).toBe("sk-ant-headers-probe");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("content-type")).toBe("application/json");
    const body = JSON.parse((c.init.body as string) ?? "{}");
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.max_tokens).toBe(1);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});

// ---------------------------------------------------------------------------
// 4.2 status → errorKey mapping (table-driven)
// ---------------------------------------------------------------------------

describe("anthropicAdapter — status → errorKey mapping", () => {
  const cases: Array<{ status: number; errorKey: string; label: string }> = [
    { status: 401, errorKey: "errors.byok.invalidKey", label: "401" },
    { status: 402, errorKey: "errors.byok.outOfCredits", label: "402" },
    { status: 429, errorKey: "errors.byok.rateLimited", label: "429" },
    { status: 500, errorKey: "errors.byok.unreachable", label: "500" },
    { status: 503, errorKey: "errors.byok.unreachable", label: "503" },
    { status: 400, errorKey: "errors.byok.unreachable", label: "other 4xx (400)" },
    { status: 418, errorKey: "errors.byok.unreachable", label: "other 4xx (418)" },
  ];

  for (const c of cases) {
    test(`${c.label} → ${c.errorKey}`, async () => {
      const fetchImpl = mock(async () => jsonResponse(c.status));
      const adapter = createAnthropicAdapter(BASE, fetchImpl as unknown as typeof fetch);
      const result = await adapter.validateKey("sk-ant-status-probe");
      expect(result).toEqual({ ok: false, errorKey: c.errorKey });
    });
  }

  test("network error / fetch rejects → errors.byok.unreachable", async () => {
    const fetchImpl = mock(async () => {
      throw new TypeError("network down");
    });
    const adapter = createAnthropicAdapter(BASE, fetchImpl as unknown as typeof fetch);
    const result = await adapter.validateKey("sk-ant-network");
    expect(result).toEqual({ ok: false, errorKey: "errors.byok.unreachable" });
  });
});

// ---------------------------------------------------------------------------
// 4.3 timeout
// ---------------------------------------------------------------------------

describe("anthropicAdapter — 5s timeout", () => {
  test("AbortSignal aborts after 5s and returns errors.byok.unreachable", async () => {
    // Fake fetch that respects signal: rejects with AbortError when the
    // injected signal aborts. We use a real timer race so the adapter's
    // internal AbortSignal.timeout(5000) is the one that fires.
    const fetchImpl = mock(async (_url: unknown, init?: RequestInit) => {
      const signal = init?.signal;
      return await new Promise<Response>((_, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => {
            const err: Error & { name: string } = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
        // Never resolves on its own; relies on the abort signal.
      });
    });
    const adapter = createAnthropicAdapter(BASE, fetchImpl as unknown as typeof fetch, {
      timeoutMs: 50, // shrink test wait without changing behaviour
    });

    const result = await adapter.validateKey("sk-ant-timeout-probe");
    expect(result).toEqual({ ok: false, errorKey: "errors.byok.unreachable" });
  });
});

// ---------------------------------------------------------------------------
// 4.4 base URL override
// ---------------------------------------------------------------------------

describe("anthropicAdapter — base URL override", () => {
  test("factory uses the supplied baseUrl, not a hardcoded vendor URL", async () => {
    const calls: string[] = [];
    const fetchImpl = mock(async (url: string | URL | Request) => {
      calls.push(String(url));
      return jsonResponse(200);
    });
    const customBase = "https://anthropic.proxy.local";
    const adapter = createAnthropicAdapter(customBase, fetchImpl as unknown as typeof fetch);

    await adapter.validateKey("sk-ant-baseurl");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(`${customBase}/v1/messages`);
  });
});
