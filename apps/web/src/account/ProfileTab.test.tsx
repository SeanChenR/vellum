/**
 * ProfileTab structural tests — design Decision 10 / spec
 * "Account settings live under a single tabbed route".
 *
 * Behavior tests (form submit, validation, locale exclusion) are
 * covered by ProfilePage.test.tsx, which now exercises the same
 * underlying component via the re-export wrapper.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ProfileTab } from "./ProfileTab";

const mockUser = {
  id: "user-1",
  email: "u@example.com",
  name: "Test User",
  image: null,
  locale: "zh-TW",
  createdAt: new Date().toISOString(),
};

const mockFetch = mock(async () => Response.json({ data: mockUser }));

beforeEach(async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
  await i18n.changeLanguage("zh-TW");
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
        <ProfileTab />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("ProfileTab", () => {
  test("renders the form inside an elevated Card primitive", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Test User")).not.toBeNull();
    });
    const card = screen.getByTestId("profile-form-card");
    expect(card.getAttribute("data-variant")).toBe("elevated");
    expect(card.querySelector("form")).not.toBeNull();
  });

  test("contains both name and image inputs", async () => {
    renderTab();
    await waitFor(() => {
      expect(document.querySelector("input#name")).not.toBeNull();
    });
    expect(document.querySelector("input#image")).not.toBeNull();
  });

  test("does NOT include an outer mx-auto max-w-7xl page container (AccountPage owns it)", async () => {
    const { container } = renderTab();
    await waitFor(() => {
      expect(screen.queryByTestId("profile-form-card")).not.toBeNull();
    });
    expect(container.querySelector(":scope > div.mx-auto.max-w-7xl")).toBeNull();
  });
});
