/**
 * ApiKeysTab structural tests — design Decision 10 + 12 / spec
 * "API & MCP tab uses row-based layout with saved-state indicator".
 *
 * Full behavior tests live in ApiKeysPage.test.tsx via the re-export
 * wrapper. This file owns the structural assertions specific to the
 * tab layout: provider rows wrapped in a single Card, MCP tokens
 * section as sibling, NO pricing table. (Per UX feedback the inter-row
 * divider was removed — the rows feel like one continuous block.)
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ApiKeysTab } from "./ApiKeysTab";

const mockFetch = mock(async (url: string) => {
  if (url.endsWith("/api/account/byok")) {
    return Response.json({ data: { keys: [], preferences: {} } });
  }
  if (url.endsWith("/api/account/pat-tokens")) {
    return Response.json({ data: [] });
  }
  return Response.json({ data: null }, { status: 404 });
});

beforeEach(async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ApiKeysTab />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("ApiKeysTab", () => {
  test("renders both the provider Keys section and the MCP Tokens section", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("apikeys-section-providers")).toBeTruthy();
    });
    expect(screen.getByTestId("apikeys-section-mcp-tokens")).toBeTruthy();
  });

  test("does NOT render the legacy pricing table (moved to PricingTab)", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("apikeys-section-providers")).toBeTruthy();
    });
    expect(screen.queryAllByTestId("byok-pricing-row")).toHaveLength(0);
    expect(document.querySelector("table")).toBeNull();
  });

  test("provider rows are wrapped in a single Card with inter-row dividers", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("apikeys-section-providers")).toBeTruthy();
    });
    const section = screen.getByTestId("apikeys-section-providers");
    // Three rows must live inside one Card element
    const logos = section.querySelectorAll('[data-testid^="apikey-provider-logo-"]');
    expect(logos).toHaveLength(3);
    // UX decision: divider goes BETWEEN providers (on the wrapper),
    // not WITHIN each provider's internal zones.
    expect(section.querySelector(".divide-y")).not.toBeNull();
  });
});
