/**
 * useApiKeys.test.ts — TanStack Query hooks for /api/account/byok/*.
 *
 * Verifies the hook reflects the M11.2/M11.3 envelope:
 *   `GET /api/account/byok` returns `{ data: { keys, preferences } }`.
 * Adds coverage for `useUpdatePreferences()` mutation: it PATCHes the
 * preferences endpoint and surfaces server errorKey on failure.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useApiKeysList, useUpdatePreferences } from "./useApiKeys";

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

let fetchCalls: FetchCall[] = [];
let nextResponse: { status: number; body: unknown } = {
  status: 200,
  body: { data: { keys: [], preferences: null } },
};
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    let body: unknown = undefined;
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }
    fetchCalls.push({ url, method, body });
    return new Response(JSON.stringify(nextResponse.body), {
      status: nextResponse.status,
      headers: { "content-type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe("useApiKeysList", () => {
  test("returns { keys, preferences-as-map } from the GET envelope", async () => {
    nextResponse = {
      status: 200,
      body: {
        data: {
          keys: [{ provider: "anthropic", createdAt: "2026-05-07", lastUsedAt: null }],
          preferences: {
            anthropic: { model: "claude-haiku-4-5", updatedAt: "2026-05-07" },
            openai: { model: "gpt-5-mini", updatedAt: "2026-05-07" },
          },
        },
      },
    };
    const { result } = renderHook(() => useApiKeysList(), { wrapper: wrap() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.keys).toHaveLength(1);
    expect(result.current.data?.preferences).toEqual({
      anthropic: { model: "claude-haiku-4-5", updatedAt: "2026-05-07" },
      openai: { model: "gpt-5-mini", updatedAt: "2026-05-07" },
    });
  });
});

describe("useUpdatePreferences", () => {
  test("on success: PATCHes /api/account/byok/preferences with body and returns row", async () => {
    nextResponse = {
      status: 200,
      body: {
        data: { provider: "openai", model: "gpt-5-mini", updatedAt: "2026-05-07T12:00:00.000Z" },
      },
    };
    const { result } = renderHook(() => useUpdatePreferences(), { wrapper: wrap() });

    await act(async () => {
      await result.current.mutateAsync({ provider: "openai", model: "gpt-5-mini" });
    });

    const patchCall = fetchCalls.find((c) => c.method === "PATCH");
    expect(patchCall?.url).toMatch(/\/api\/account\/byok\/preferences$/);
    expect(patchCall?.body).toEqual({ provider: "openai", model: "gpt-5-mini" });
  });

  test("on failure: thrown error.message is the server errorKey", async () => {
    nextResponse = {
      status: 400,
      body: { error: "errors.byok.invalidPreference" },
    };
    const { result } = renderHook(() => useUpdatePreferences(), { wrapper: wrap() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ provider: "openai", model: "gpt-9000" }),
      ).rejects.toThrow("errors.byok.invalidPreference");
    });
  });
});
