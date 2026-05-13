/**
 * usePatTokens.test.ts — TanStack Query hooks for /api/account/pat/*.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   - "GET /api/account/pat lists the signed-in user's active tokens"
 *   - "POST /api/account/pat creates a token and returns plaintext once"
 *   - "DELETE /api/account/pat/:id soft-revokes the token"
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { usePatTokens, useCreatePatToken, useRevokePatToken } from "./usePatTokens";

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

let fetchCalls: FetchCall[] = [];
let nextResponse: { status: number; body: unknown } = { status: 200, body: { data: [] } };
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
    return new Response(nextResponse.status === 204 ? null : JSON.stringify(nextResponse.body), {
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

describe("usePatTokens", () => {
  test("returns rows from GET /api/account/pat envelope", async () => {
    nextResponse = {
      status: 200,
      body: {
        data: [
          {
            id: "pat_1",
            name: "Claude Desktop",
            prefix: "vlm_pat_abcd",
            expiresAt: "2026-08-01T00:00:00.000Z",
            lastUsedAt: "2026-05-12T10:00:00.000Z",
            createdAt: "2026-05-01T00:00:00.000Z",
          },
        ],
      },
    };
    const { result } = renderHook(() => usePatTokens(), { wrapper: wrap() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.id).toBe("pat_1");
    expect(result.current.data?.[0]?.prefix).toBe("vlm_pat_abcd");
    expect(fetchCalls[0]?.url).toMatch(/\/api\/account\/pat$/);
    expect(fetchCalls[0]?.method).toBe("GET");
  });
});

describe("useCreatePatToken", () => {
  test("POSTs body and returns plaintext + metadata", async () => {
    nextResponse = {
      status: 201,
      body: {
        data: {
          token: "vlm_pat_abcdefghijklmnopqrstuvwxyz123456",
          id: "pat_new",
          name: "Cursor",
          prefix: "vlm_pat_abcd",
          expiresAt: null,
          createdAt: "2026-05-13T00:00:00.000Z",
        },
      },
    };
    const { result } = renderHook(() => useCreatePatToken(), { wrapper: wrap() });

    let response: { token: string; id: string } | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({ name: "Cursor", expiresInDays: null });
    });

    const post = fetchCalls.find((c) => c.method === "POST");
    expect(post?.url).toMatch(/\/api\/account\/pat$/);
    expect(post?.body).toEqual({ name: "Cursor", expiresInDays: null });
    expect(response?.token).toBe("vlm_pat_abcdefghijklmnopqrstuvwxyz123456");
    expect(response?.id).toBe("pat_new");
  });

  test("on failure: thrown error.message carries server errorKey", async () => {
    nextResponse = { status: 400, body: { error: "errors.validation" } };
    const { result } = renderHook(() => useCreatePatToken(), { wrapper: wrap() });

    await act(async () => {
      await expect(result.current.mutateAsync({ name: "", expiresInDays: 30 })).rejects.toThrow(
        "errors.validation",
      );
    });
  });
});

describe("useRevokePatToken", () => {
  test("DELETEs /api/account/pat/:id and resolves on 204", async () => {
    nextResponse = { status: 204, body: null };
    const { result } = renderHook(() => useRevokePatToken(), { wrapper: wrap() });

    await act(async () => {
      await result.current.mutateAsync("pat_abc");
    });

    const del = fetchCalls.find((c) => c.method === "DELETE");
    expect(del?.url).toMatch(/\/api\/account\/pat\/pat_abc$/);
  });

  test("on 404: thrown error carries server errorKey", async () => {
    nextResponse = { status: 404, body: { error: "errors.notFound" } };
    const { result } = renderHook(() => useRevokePatToken(), { wrapper: wrap() });

    await act(async () => {
      await expect(result.current.mutateAsync("pat_missing")).rejects.toThrow("errors.notFound");
    });
  });
});
