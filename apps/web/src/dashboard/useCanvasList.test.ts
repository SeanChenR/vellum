/**
 * useCanvasList hook tests.
 *
 * Verifies that canvas mutations invalidate the list query on settle,
 * triggering a list refetch.
 *
 * Spec: §10.3 — invalidateQueries re-triggers list refetch after mutation
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FC, ReactNode } from "react";
import React from "react";
import { useCanvasList, canvasListKey } from "./useCanvasList";
import type { Canvas } from "./useCanvasList";

// Ensure the real module is used regardless of what other test files may have mocked
mock.module("./useCanvasList", () => require("./useCanvasList"));

afterEach(() => {
  cleanup();
});

const MOCK_CANVAS: Canvas = {
  id: "c1",
  ownerId: "u1",
  folderId: null,
  title: "Test Canvas",
  snapshot: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeWrapper(queryClient: QueryClient): FC<{ children: ReactNode }> {
  return function Wrapper({ children }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("useCanvasList — invalidateQueries after mutation", () => {
  test("renameCanvas mutation invalidates the list query on settle (success)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let fetchCount = 0;

    // Pre-populate cache
    queryClient.setQueryData(canvasListKey("owned"), [MOCK_CANVAS]);

    // Mock fetch for the PATCH call
    const globalFetch = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      if (url.includes("/api/canvas/c1")) {
        return new Response(
          JSON.stringify({ data: { ...MOCK_CANVAS, title: "Renamed" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/canvas")) {
        fetchCount++;
        return new Response(
          JSON.stringify({ data: [{ ...MOCK_CANVAS, title: "Renamed" }], meta: { total: 1 } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useCanvasList("owned"), { wrapper });

    const prevFetchCount = fetchCount;

    await act(async () => {
      await result.current.renameCanvas.mutateAsync({ id: "c1", title: "Renamed" });
    });

    await waitFor(() => {
      // invalidateQueries should have triggered a refetch of the list
      expect(fetchCount).toBeGreaterThan(prevFetchCount);
    });

    global.fetch = globalFetch;
  });

  test("deleteCanvas mutation invalidates the list query on settle", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let fetchCount = 0;
    queryClient.setQueryData(canvasListKey("owned"), [MOCK_CANVAS]);

    const globalFetch = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      if (url.includes("/api/canvas/c1")) {
        return new Response(null, { status: 204 });
      }
      if (url.includes("/api/canvas")) {
        fetchCount++;
        return new Response(
          JSON.stringify({ data: [], meta: { total: 0 } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useCanvasList("owned"), { wrapper });

    const prevFetchCount = fetchCount;

    await act(async () => {
      await result.current.deleteCanvas.mutateAsync("c1");
    });

    await waitFor(() => {
      expect(fetchCount).toBeGreaterThan(prevFetchCount);
    });

    global.fetch = globalFetch;
  });
});
