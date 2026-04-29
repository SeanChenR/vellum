/**
 * MagicLinkVerifyPage component tests.
 *
 * Scenarios:
 * - valid token in URL navigates to /dashboard
 * - expired token shows auth.errors.magicLinkExpired message
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { MagicLinkVerifyPage } from "./MagicLinkVerifyPage";

const mockNavigate = mock((_path: string) => {});

// Mock @tanstack/react-router's useNavigate and useSearch
mock.module("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({ token: "test-token" }),
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to);
    return null;
  },
}));

const mockFetch = mock(async (_url: string) => Response.json({ data: {} }, { status: 200 }));

afterEach(() => {
  cleanup();
  mockNavigate.mockClear();
  mockFetch.mockClear();
});

function renderPage(token = "valid-token") {
  mock.module("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
    useSearch: () => ({ token }),
    Navigate: ({ to }: { to: string }) => {
      mockNavigate(to);
      return null;
    },
  }));

  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;

  return render(
    <I18nextProvider i18n={i18n}>
      <MagicLinkVerifyPage />
    </I18nextProvider>,
  );
}

describe("MagicLinkVerifyPage", () => {
  test("valid token: navigates to /dashboard on success", async () => {
    mockFetch.mockImplementation(async () => Response.json({ data: {} }, { status: 200 }));
    renderPage("valid-token");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("expired token: shows magicLinkExpired error message", async () => {
    mockFetch.mockImplementation(async () =>
      Response.json({ error: { errorKey: "auth.errors.magicLinkExpired" } }, { status: 400 }),
    );
    renderPage("expired-token");

    await waitFor(() => {
      // The component must render something that reflects the expired error
      const el = document.querySelector("[data-testid='verify-error']");
      expect(el).not.toBeNull();
    });
  });
});
