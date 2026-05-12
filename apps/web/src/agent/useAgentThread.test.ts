/**
 * useAgentThread.test.ts — TanStack Query hooks for /api/agent/threads/*.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 *   - "Thread switcher allows multi-thread navigation"
 *   - "Token usage footer displays per-run and cumulative usage" (total path)
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  useAgentThread,
  useAgentThreadList,
  useClearThread,
  useCreateThread,
  useDeleteThread,
} from "./useAgentThread";

interface FetchCall {
  url: string;
  method: string;
}

let fetchCalls: FetchCall[] = [];
let nextResponse: { status: number; body: unknown } = { status: 200, body: { data: {} } };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    fetchCalls.push({ url, method });
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

// ---------------------------------------------------------------------------

describe("useAgentThreadList", () => {
  test("returns { threads, activeThreadId } from the GET envelope", async () => {
    nextResponse = {
      status: 200,
      body: {
        data: {
          threads: [
            {
              id: "t2",
              title: "newer",
              updatedAt: "2026-05-09T01:00:00Z",
              createdAt: "2026-05-09T00:00:00Z",
            },
            {
              id: "t1",
              title: "older",
              updatedAt: "2026-05-08T00:00:00Z",
              createdAt: "2026-05-07T00:00:00Z",
            },
          ],
          activeThreadId: "t2",
        },
      },
    };
    const { result } = renderHook(() => useAgentThreadList("c1"), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.activeThreadId).toBe("t2");
    expect(result.current.data?.threads.length).toBe(2);
    expect(fetchCalls[0]?.url).toBe("/api/agent/threads/canvas/c1");
    expect(fetchCalls[0]?.method).toBe("GET");
  });

  test("surfaces errorKey from non-2xx response", async () => {
    nextResponse = {
      status: 401,
      body: { errorKey: "agent.error.permissionDenied" },
    };
    const { result } = renderHook(() => useAgentThreadList("c1"), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("agent.error.permissionDenied");
  });
});

describe("useAgentThread", () => {
  test("returns { thread, messages, usage } and exposes total usage", async () => {
    nextResponse = {
      status: 200,
      body: {
        data: {
          thread: {
            id: "t1",
            userId: "u1",
            canvasId: "c1",
            title: "test",
            createdAt: "2026-05-09T00:00:00Z",
            updatedAt: "2026-05-09T00:00:00Z",
          },
          messages: [],
          usage: { input: 300, output: 125 },
        },
      },
    };
    const { result } = renderHook(() => useAgentThread("t1"), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.usage).toEqual({ input: 300, output: 125 });
  });

  test("does not fetch when threadId is null", async () => {
    const { result } = renderHook(() => useAgentThread(null), { wrapper: wrap() });
    expect(result.current.isFetching).toBe(false);
    expect(fetchCalls.length).toBe(0);
  });
});

describe("useCreateThread + useDeleteThread + useClearThread", () => {
  test("create POSTs and returns 201 row", async () => {
    nextResponse = {
      status: 201,
      body: {
        data: {
          id: "t3",
          title: "",
          createdAt: "2026-05-09T00:00:00Z",
          updatedAt: "2026-05-09T00:00:00Z",
        },
      },
    };
    const { result } = renderHook(() => useCreateThread("c1"), { wrapper: wrap() });
    await act(async () => {
      const created = await result.current.mutateAsync();
      expect(created.id).toBe("t3");
    });
    expect(fetchCalls[0]?.method).toBe("POST");
    expect(fetchCalls[0]?.url).toBe("/api/agent/threads/canvas/c1");
  });

  test("clear POSTs to /:id/clear", async () => {
    nextResponse = { status: 204, body: null };
    const { result } = renderHook(() => useClearThread("c1"), { wrapper: wrap() });
    await act(async () => {
      await result.current.mutateAsync("t1");
    });
    expect(fetchCalls[0]?.method).toBe("POST");
    expect(fetchCalls[0]?.url).toBe("/api/agent/threads/t1/clear");
  });

  test("delete DELETEs to /:id", async () => {
    nextResponse = { status: 204, body: null };
    const { result } = renderHook(() => useDeleteThread("c1"), { wrapper: wrap() });
    await act(async () => {
      await result.current.mutateAsync("t1");
    });
    expect(fetchCalls[0]?.method).toBe("DELETE");
    expect(fetchCalls[0]?.url).toBe("/api/agent/threads/t1");
  });
});
