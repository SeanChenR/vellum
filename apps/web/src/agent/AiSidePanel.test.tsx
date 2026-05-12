/**
 * AiSidePanel.test.tsx — composition smoke tests.
 *
 * These are intentionally lightweight: the children (ChatList /
 * ChatComposer / TokenUsageFooter / ThreadSwitcher) carry their own
 * behavioral tests. Here we verify the panel mounts and surfaces the
 * server response shape end-to-end.
 *
 * Spec ref: ai-side-panel "Side Panel docks into Editor and is collapsible"
 * (the dock-vs-collapse flow is tested at the Editor integration level).
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import i18n from "../i18n";
import { AiSidePanel } from "./AiSidePanel";

const originalFetch = globalThis.fetch;

// Map URL prefix → response.
const responses: Record<string, { status: number; body: unknown }> = {};

beforeEach(() => {
  // Empty thread on first GET; lazy-create returns a single thread.
  responses["/api/agent/threads/canvas/c1"] = {
    status: 200,
    body: {
      data: {
        threads: [
          {
            id: "t1",
            title: "test thread",
            createdAt: "2026-05-09T00:00:00Z",
            updatedAt: "2026-05-09T00:00:00Z",
          },
        ],
        activeThreadId: "t1",
      },
    },
  };
  responses["/api/agent/threads/t1"] = {
    status: 200,
    body: {
      data: {
        thread: {
          id: "t1",
          userId: "u1",
          canvasId: "c1",
          title: "test thread",
          createdAt: "2026-05-09T00:00:00Z",
          updatedAt: "2026-05-09T00:00:00Z",
        },
        messages: [],
        usage: { input: 0, output: 0 },
      },
    },
  };
  responses["/api/account/byok"] = {
    status: 200,
    body: { data: { keys: [], preferences: {} } },
  };

  globalThis.fetch = mock(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.keys(responses).find((k) => url.endsWith(k));
    const r = match ? responses[match]! : { status: 404, body: { errorKey: "not-found" } };
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("AiSidePanel — composition", () => {
  test("mounts the four children once data resolves", async () => {
    wrap(<AiSidePanel canvasId="c1" />);
    await waitFor(() => {
      expect(screen.getByTestId("ai-side-panel")).toBeDefined();
    });
    expect(screen.getByTestId("thread-switcher")).toBeDefined();
    expect(screen.getByTestId("chat-list")).toBeDefined();
    expect(screen.getByTestId("chat-composer-textarea")).toBeDefined();
    expect(screen.getByTestId("token-usage-footer")).toBeDefined();
  });
});
