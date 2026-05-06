/**
 * useFolderList mutations test — covers create / rename / delete paths
 * and the deleteFolder error path when the folder is non-empty.
 *
 * Spec: e2e-coverage — "Dashboard data layer reaches at least 60% line
 * coverage". Implements the spec scenarios "useFolderList deleteFolder
 * error surfaces the not-empty error key" and the standard mutation
 * invalidation semantics.
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FC, ReactNode } from "react";
import React from "react";
import { useFolderList, FOLDER_LIST_KEY } from "./useFolderList";
import type { Folder } from "./useFolderList";

mock.module("./useFolderList", () => require("./useFolderList"));

afterEach(() => cleanup());

const MOCK: Folder = {
  id: "f-1",
  ownerId: "u1",
  name: "First",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeWrapper(qc: QueryClient): FC<{ children: ReactNode }> {
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("useFolderList — invalidate on mutation success", () => {
  test("createFolder invalidates folder list on settle", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(FOLDER_LIST_KEY, []);
    let listRefetches = 0;

    const orig = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
      if (url.endsWith("/api/folder") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: MOCK }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/api/folder")) {
        listRefetches += 1;
        return new Response(JSON.stringify({ data: [MOCK], meta: { total: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFolderList(), { wrapper: makeWrapper(qc) });

    const before = listRefetches;
    await act(async () => {
      await result.current.createFolder.mutateAsync("First");
    });
    await waitFor(() => expect(listRefetches).toBeGreaterThan(before));

    global.fetch = orig;
  });

  test("renameFolder invalidates folder list on settle (optimistic)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(FOLDER_LIST_KEY, [MOCK]);
    let listRefetches = 0;

    const orig = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
      if (url.includes("/api/folder/f-1") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ data: { ...MOCK, name: "Renamed" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/folder")) {
        listRefetches += 1;
        return new Response(
          JSON.stringify({ data: [{ ...MOCK, name: "Renamed" }], meta: { total: 1 } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFolderList(), { wrapper: makeWrapper(qc) });

    const before = listRefetches;
    await act(async () => {
      await result.current.renameFolder.mutateAsync({ id: "f-1", name: "Renamed" });
    });
    await waitFor(() => expect(listRefetches).toBeGreaterThan(before));

    global.fetch = orig;
  });

  test("deleteFolder invalidates folder list on settle (success path)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(FOLDER_LIST_KEY, [MOCK]);
    let listRefetches = 0;

    const orig = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
      if (url.includes("/api/folder/f-1") && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      if (url.includes("/api/folder")) {
        listRefetches += 1;
        return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFolderList(), { wrapper: makeWrapper(qc) });

    const before = listRefetches;
    await act(async () => {
      await result.current.deleteFolder.mutateAsync("f-1");
    });
    await waitFor(() => expect(listRefetches).toBeGreaterThan(before));

    global.fetch = orig;
  });

  test("deleteFolder rejects with errors.folder.notEmpty when server returns 409", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(FOLDER_LIST_KEY, [MOCK]);

    const orig = global.fetch;
    global.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
      if (url.includes("/api/folder/f-1") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ error: { errorKey: "errors.folder.notEmpty" } }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/folder")) {
        return new Response(JSON.stringify({ data: [MOCK], meta: { total: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFolderList(), { wrapper: makeWrapper(qc) });

    let caught: Error | null = null;
    await act(async () => {
      try {
        await result.current.deleteFolder.mutateAsync("f-1");
      } catch (err) {
        caught = err as Error;
      }
    });

    expect(caught).not.toBeNull();
    // Hook re-throws an Error with errorKey attached for the 409 path.
    const errorKey = (caught as unknown as { errorKey?: string })?.errorKey;
    expect(errorKey).toBe("errors.folder.notEmpty");

    global.fetch = orig;
  });
});
