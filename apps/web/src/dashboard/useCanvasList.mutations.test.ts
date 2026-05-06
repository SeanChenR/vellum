/**
 * useCanvasList mutations test — covers the create + move paths that
 * the existing useCanvasList.test.ts (rename + delete) does not.
 *
 * Spec: e2e-coverage — "Dashboard data layer reaches at least 60% line coverage".
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FC, ReactNode } from "react";
import React from "react";
import { useCanvasList, canvasListKey } from "./useCanvasList";
import type { Canvas } from "./useCanvasList";

// Re-export the real module so any prior test's mock.module on this path
// is overridden and we test the real mutation logic.
mock.module("./useCanvasList", () => require("./useCanvasList"));

afterEach(() => cleanup());

const MOCK: Canvas = {
  id: "c-new",
  ownerId: "u1",
  folderId: null,
  title: "New Canvas",
  snapshot: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeWrapper(qc: QueryClient): FC<{ children: ReactNode }> {
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("useCanvasList — additional mutations", () => {
  test("createCanvas mutation invalidates the list query on settle", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(canvasListKey("owned"), []);
    let listRefetches = 0;

    const orig = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
      if (url.endsWith("/api/canvas") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: MOCK }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/canvas")) {
        listRefetches += 1;
        return new Response(JSON.stringify({ data: [MOCK], meta: { total: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCanvasList("owned"), {
      wrapper: makeWrapper(qc),
    });

    const before = listRefetches;
    await act(async () => {
      await result.current.createCanvas.mutateAsync({ title: "New Canvas", folderId: null });
    });
    await waitFor(() => expect(listRefetches).toBeGreaterThan(before));

    global.fetch = orig;
  });

  test("moveCanvas mutation invalidates the list query on settle", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(canvasListKey("owned"), [MOCK]);
    let listRefetches = 0;

    const orig = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
      if (url.includes("/api/canvas/c-new") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ data: { ...MOCK, folderId: "f-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/canvas")) {
        listRefetches += 1;
        return new Response(JSON.stringify({ data: [MOCK], meta: { total: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCanvasList("owned"), {
      wrapper: makeWrapper(qc),
    });

    const before = listRefetches;
    await act(async () => {
      await result.current.moveCanvas.mutateAsync({ id: "c-new", folderId: "f-1" });
    });
    await waitFor(() => expect(listRefetches).toBeGreaterThan(before));

    global.fetch = orig;
  });
});
