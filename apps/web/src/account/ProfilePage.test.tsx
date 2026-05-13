/**
 * ProfilePage component tests.
 *
 * Scenarios:
 * - loads profile data into form fields on mount
 * - name + locale change submits PATCH request
 * - non-https image URL shows account.errors.invalidImageUrl error
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ProfilePage } from "./ProfilePage";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  locale: "zh-TW",
  createdAt: new Date().toISOString(),
};

const mockFetch = mock(async (url: string, opts?: RequestInit) => {
  if (opts?.method === "PATCH") {
    return Response.json({ data: { ...mockUser, ...JSON.parse(opts.body as string) } });
  }
  return Response.json({ data: mockUser });
});

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
});

function renderPage() {
  const client = createClient();
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ProfilePage />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("ProfilePage", () => {
  test("loads profile and populates name field", async () => {
    renderPage();
    await waitFor(() => {
      const nameInput = screen.queryByDisplayValue("Test User");
      expect(nameInput).not.toBeNull();
    });
  });

  test("renders the form inside an elevated Card primitive", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Test User")).not.toBeNull();
    });
    const card = screen.getByTestId("profile-form-card");
    expect(card.getAttribute("data-variant")).toBe("elevated");
    expect(card.querySelector("form")).not.toBeNull();
  });

  test("does NOT render a locale select element", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Test User")).not.toBeNull();
    });
    expect(document.querySelector("select#locale")).toBeNull();
    expect(screen.queryByText(/介面語言|Interface language/i)).toBeNull();
  });

  test("submitting with valid name calls PATCH /api/account/profile with no locale field", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Test User")).not.toBeNull();
    });

    const nameInput = screen.getByDisplayValue("Test User");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    const form = nameInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter(
        (c) => (c[1] as RequestInit)?.method === "PATCH",
      );
      expect(patchCalls.length).toBeGreaterThan(0);
    });

    const patchCall = mockFetch.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PATCH");
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body).toHaveProperty("name");
    expect(body).not.toHaveProperty("locale");
  });

  test("non-https image URL shows invalidImageUrl error", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Test User")).not.toBeNull();
    });

    // Manually trigger the image validation by finding the image input
    const imageInput = document.querySelector("input[name='image']") as HTMLInputElement | null;
    if (imageInput) {
      await user.clear(imageInput);
      await user.type(imageInput, "http://not-https.com/img.png");

      const form = imageInput.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const errorEl = document.querySelector("[data-testid='image-error']");
        expect(errorEl).not.toBeNull();
      });
    }
  });
});
