/**
 * useCanvasQuery — URL / queryKey unit tests.
 *
 * The hook is a thin wrapper over TanStack `useQuery`; the only logic
 * we own is (a) the URL it fetches and (b) the queryKey shape. We mock
 * `useQuery` so we can capture the `queryFn` and run it against a fetch
 * spy, then assert the URL — which is the bug fix surface for the
 * "anonymous visitor with `?share=` token still hits the API without
 * the token" regression.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

let capturedQueryKey: unknown[] | undefined;
let capturedQueryFn: (() => Promise<unknown>) | undefined;

// Full mock of @tanstack/react-query — provide every named export the
// surrounding suite touches so module-level mocks from other tests don't
// collide with this one's narrower needs (CanvasPage.test.tsx uses
// useMutation / QueryClient via the same module graph).
mock.module("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, queryFn }: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => {
    capturedQueryKey = queryKey;
    capturedQueryFn = queryFn;
    return { data: undefined, isLoading: true, isError: false };
  },
  useMutation: () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: () => {} }),
  QueryClient: class {
    invalidateQueries() {}
  },
  QueryClientProvider: ({ children }: { children: unknown }) => children,
}));

const { canvasQueryKey, useCanvasQuery } = await import("./useCanvasQuery");

const fakeCanvas = {
  id: "canvas-1",
  ownerId: "u1",
  folderId: null,
  title: "T",
  snapshot: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const okResponse = () =>
  new Response(JSON.stringify({ data: fakeCanvas }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

let fetchCalls: string[] = [];
let originalFetch: typeof fetch;

beforeEach(() => {
  fetchCalls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    fetchCalls.push(typeof input === "string" ? input : input.toString());
    return Promise.resolve(okResponse());
  }) as typeof fetch;
  capturedQueryKey = undefined;
  capturedQueryFn = undefined;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("canvasQueryKey", () => {
  test("returns ['canvas','single', id] when no shareToken", () => {
    expect(canvasQueryKey("canvas-1")).toEqual(["canvas", "single", "canvas-1"]);
  });

  test("includes shareToken segments when provided", () => {
    expect(canvasQueryKey("canvas-1", "tok-abc")).toEqual([
      "canvas",
      "single",
      "canvas-1",
      "share",
      "tok-abc",
    ]);
  });
});

describe("useCanvasQuery — fetch URL", () => {
  test("without shareToken hits /api/canvas/:id", async () => {
    useCanvasQuery("canvas-1");
    await capturedQueryFn?.();
    expect(fetchCalls).toEqual(["/api/canvas/canvas-1"]);
  });

  test("with shareToken appends ?share=<token>", async () => {
    useCanvasQuery("canvas-1", "tok-abc");
    await capturedQueryFn?.();
    expect(fetchCalls).toEqual(["/api/canvas/canvas-1?share=tok-abc"]);
  });

  test("URL-encodes shareToken with special characters", async () => {
    useCanvasQuery("canvas-1", "a/b+c=d");
    await capturedQueryFn?.();
    expect(fetchCalls).toEqual(["/api/canvas/canvas-1?share=a%2Fb%2Bc%3Dd"]);
  });

  test("queryKey matches canvasQueryKey output (with token)", () => {
    useCanvasQuery("canvas-1", "tok-abc");
    expect(capturedQueryKey).toEqual(canvasQueryKey("canvas-1", "tok-abc"));
  });
});
