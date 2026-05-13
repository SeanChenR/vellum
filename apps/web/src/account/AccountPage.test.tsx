/**
 * AccountPage tests — design Decision 10 / spec account ADDED Requirement
 * "Account settings live under a single tabbed route".
 *
 * These tests assert AccountPage's *routing* behavior (which tab is
 * active given the URL search param, navigation on click, container
 * width). Each panel's behaviour is covered by ProfileTab.test.tsx /
 * SessionsTab.test.tsx / ApiKeysTab.test.tsx / PricingTab.test.tsx —
 * we deliberately avoid `mock.module` of the panel files so this run
 * doesn't pollute the global module cache for those sibling tests.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../i18n";

const mockNavigate = mock((_args: unknown) => {});
let mockSearch: { tab?: string } = {};

const RealRouter = await import("@tanstack/react-router");
mock.module("@tanstack/react-router", () => ({
  ...RealRouter,
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearch,
}));

// Stub `fetch` for the panels that try to call it on mount. The four
// panels do their own data loading; we don't care what they show — only
// that the right one is rendered for each ?tab= value. A no-op fetch
// keeps the request from crashing the test runner with ECONNREFUSED.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () =>
  new Response(JSON.stringify({ data: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })) as unknown as typeof fetch;

const { AccountPage } = await import("./AccountPage");

function renderPage(tab?: string) {
  mockSearch = tab !== undefined ? { tab } : {};
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <AccountPage />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  mockNavigate.mockClear();
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => {
  cleanup();
});

// Sink reference to satisfy the linter — the override is intentional
// and persists for this test file only.
void originalFetch;

function activeTabId(): string | null {
  const tabs = screen.getAllByRole("tab");
  const active = tabs.find((t) => t.getAttribute("aria-selected") === "true");
  return active?.id ?? null;
}

describe("AccountPage", () => {
  test("default (no ?tab=) renders with the profile tab marked aria-selected", () => {
    renderPage();
    expect(activeTabId()).toBe("tab-profile");
  });

  test("?tab=api-keys marks the API tab as aria-selected", () => {
    renderPage("api-keys");
    expect(activeTabId()).toBe("tab-api-keys");
  });

  test("?tab=pricing marks the pricing tab as aria-selected (deep-link)", () => {
    renderPage("pricing");
    expect(activeTabId()).toBe("tab-pricing");
  });

  test("?tab=sessions marks the sessions tab as aria-selected", () => {
    renderPage("sessions");
    expect(activeTabId()).toBe("tab-sessions");
  });

  test("invalid ?tab= falls back to profile", () => {
    renderPage("bogus");
    expect(activeTabId()).toBe("tab-profile");
  });

  test("clicking a tab calls navigate with the corresponding ?tab= search and replace=true", () => {
    renderPage("profile");
    const apiKeysTab = screen.getAllByRole("tab").find((t) => t.id === "tab-api-keys")!;
    fireEvent.click(apiKeysTab);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const arg = mockNavigate.mock.calls[0]?.[0] as {
      to?: string;
      search?: { tab?: string };
      replace?: boolean;
    };
    expect(arg.to).toBe("/account");
    expect(arg.search?.tab).toBe("api-keys");
    expect(arg.replace).toBe(true);
  });

  test("outer container uses mx-auto max-w-7xl px-6 py-10 md:px-8", () => {
    const { container } = renderPage();
    const outer = container.querySelector("div.mx-auto.max-w-7xl");
    expect(outer).not.toBeNull();
    expect(outer!.className).toContain("py-10");
  });

  test("renders exactly four tabs labelled in zh-TW", () => {
    renderPage();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toContain("個人資料");
    expect(labels).toContain("登入裝置");
    expect(labels).toContain("API 與 MCP");
    expect(labels).toContain("定價參考");
  });
});
