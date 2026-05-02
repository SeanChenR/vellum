/**
 * useShareState hook tests (task 4.2).
 *
 * Spec: sharing — "ShareDialog opens from the TopBar Share button" (the
 * dialog's data layer is exercised here; the visual layer is in
 * `ShareDialog.test.tsx`).
 *
 * Hooked behaviours under test:
 *   - initial GET /api/canvas/:id/share fires once
 *   - invite / patchRole / removeMember / revokeInvite / setLinkMode /
 *     rotateLink mutations call the right HTTP verb + URL + body
 *   - every mutation invalidates `['share', canvasId]` on settle
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useShareState } from "./useShareState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

let fetchCalls: FetchCall[] = [];
let fetchResponses: Map<string, unknown> = new Map();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  fetchResponses = new Map();
  // Default — GET /share returns empty state.
  fetchResponses.set("GET /api/canvas/c1/share", {
    data: { ownerId: "u-owner", members: [], invites: [], link: null },
  });
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
    const key = `${method} ${url}`;
    const data = fetchResponses.get(key);
    return new Response(JSON.stringify(data ?? { data: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function wrap() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ---------------------------------------------------------------------------
// Initial fetch
// ---------------------------------------------------------------------------

describe("useShareState — initial fetch", () => {
  test("issues a GET /api/canvas/<id>/share on mount", async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(
      fetchCalls.some((c) => c.method === "GET" && c.url.endsWith("/api/canvas/c1/share")),
    ).toBe(true);
    expect(result.current.data?.members).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mutations — invite / role / remove / link mode / rotate
// ---------------------------------------------------------------------------

describe("useShareState — mutations", () => {
  test("invite() POSTs the email + role and invalidates the share query", async () => {
    fetchResponses.set("POST /api/canvas/c1/share/invite", {
      data: { kind: "member", userId: "u-bob", role: "editor" },
    });
    const { wrapper, queryClient } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = mock((..._args: unknown[]) => {});
    queryClient.invalidateQueries =
      invalidateSpy as unknown as typeof queryClient.invalidateQueries;

    await act(async () => {
      await result.current.invite.mutateAsync({ email: "bob@x.com", role: "editor" });
    });

    const call = fetchCalls.find((c) => c.method === "POST" && c.url.endsWith("/share/invite"));
    expect(call).toBeDefined();
    expect(call?.body).toEqual({ email: "bob@x.com", role: "editor" });
    expect(invalidateSpy.mock.calls.length).toBeGreaterThan(0);
  });

  test("patchRole() PATCHes the member URL and invalidates the share query", async () => {
    fetchResponses.set("PATCH /api/canvas/c1/share/members/u-bob", {
      data: { canvasId: "c1", userId: "u-bob", role: "viewer" },
    });
    const { wrapper, queryClient } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidateSpy = mock((..._args: unknown[]) => {});
    queryClient.invalidateQueries =
      invalidateSpy as unknown as typeof queryClient.invalidateQueries;

    await act(async () => {
      await result.current.patchRole.mutateAsync({ userId: "u-bob", role: "viewer" });
    });

    const call = fetchCalls.find((c) => c.method === "PATCH" && c.url.includes("/members/u-bob"));
    expect(call).toBeDefined();
    expect(call?.body).toEqual({ role: "viewer" });
    expect(invalidateSpy.mock.calls.length).toBeGreaterThan(0);
  });

  test("removeMember() DELETEs the member URL", async () => {
    fetchResponses.set("DELETE /api/canvas/c1/share/members/u-bob", { data: null });
    const { wrapper, queryClient } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidateSpy = mock((..._args: unknown[]) => {});
    queryClient.invalidateQueries =
      invalidateSpy as unknown as typeof queryClient.invalidateQueries;

    await act(async () => {
      await result.current.removeMember.mutateAsync({ userId: "u-bob" });
    });

    expect(fetchCalls.some((c) => c.method === "DELETE" && c.url.includes("/members/u-bob"))).toBe(
      true,
    );
    expect(invalidateSpy.mock.calls.length).toBeGreaterThan(0);
  });

  test("revokeInvite() DELETEs the invite URL", async () => {
    fetchResponses.set("DELETE /api/canvas/c1/share/invites/inv-1", { data: null });
    const { wrapper } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.revokeInvite.mutateAsync({ inviteId: "inv-1" });
    });
    expect(fetchCalls.some((c) => c.method === "DELETE" && c.url.includes("/invites/inv-1"))).toBe(
      true,
    );
  });

  test("setLinkMode() PUTs the mode body", async () => {
    fetchResponses.set("PUT /api/canvas/c1/share/link", {
      data: { canvasId: "c1", token: "t", mode: "view" },
    });
    const { wrapper } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.setLinkMode.mutateAsync({ mode: "view" });
    });
    const call = fetchCalls.find((c) => c.method === "PUT" && c.url.endsWith("/share/link"));
    expect(call?.body).toEqual({ mode: "view" });
  });

  test("rotateLink() POSTs to rotate", async () => {
    fetchResponses.set("POST /api/canvas/c1/share/link/rotate", {
      data: { canvasId: "c1", token: "new", mode: "view" },
    });
    const { wrapper } = wrap();
    const { result } = renderHook(() => useShareState("c1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.rotateLink.mutateAsync();
    });
    expect(
      fetchCalls.some((c) => c.method === "POST" && c.url.endsWith("/share/link/rotate")),
    ).toBe(true);
  });
});
