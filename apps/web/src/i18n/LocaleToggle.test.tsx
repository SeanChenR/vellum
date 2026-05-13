/**
 * LocaleToggle.test.tsx — navbar locale toggle contract.
 *
 * Spec ref: openspec/specs/locale-switching/spec.md
 *   "Locale toggle in the navbar switches the active i18n language"
 *   "Locale preference is persisted server-side when signed in"
 *   scenarios: "Click toggles zh-TW to en", "Server patch on signed-in toggle",
 *              "No server call when signed out",
 *              "Server patch failure does not revert the UI"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../i18n";
import type { AuthUser } from "../auth/useAuth";

interface MockAuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
}

const mockAuth: MockAuthState = { isAuthenticated: false, user: null };

mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: mockAuth.isAuthenticated,
    user: mockAuth.user,
    error: null,
    logout: () => {},
  }),
}));

// Import AFTER mock.module is registered so the component picks up
// the mocked useAuth.
const { LocaleToggle } = await import("./LocaleToggle");

const signedInUser: AuthUser = {
  id: "u-1",
  email: "u@example.com",
  name: "U",
  image: null,
  locale: "zh-TW",
  createdAt: new Date().toISOString(),
};

type FetchCall = { url: string; method: string; body: unknown };
let fetchCalls: FetchCall[] = [];
let nextResponse: { status: number; body: unknown };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  nextResponse = { status: 200, body: {} };
  mockAuth.isAuthenticated = false;
  mockAuth.user = null;
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
    return new Response(JSON.stringify(nextResponse.body), {
      status: nextResponse.status,
      headers: { "content-type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
  void i18n.changeLanguage("zh-TW");
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

function renderToggle() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleToggle />
    </QueryClientProvider>,
  );
}

describe("LocaleToggle — switching", () => {
  test("renders 中 label when zh-TW is active", () => {
    renderToggle();
    expect(screen.getByRole("button").textContent).toContain("中");
  });

  test("renders EN label after switching to en", async () => {
    renderToggle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(screen.getByRole("button").textContent).toContain("EN");
  });

  test("subsequent click toggles back to zh-TW", async () => {
    renderToggle();
    const user = userEvent.setup();
    const btn = screen.getByRole("button");
    await user.click(btn);
    await waitFor(() => expect(i18n.language).toBe("en"));
    await user.click(btn);
    await waitFor(() => expect(i18n.language).toBe("zh-TW"));
  });
});

describe("LocaleToggle — server sync", () => {
  test("signed-in user click PATCHes /api/account/profile with new locale", async () => {
    mockAuth.isAuthenticated = true;
    mockAuth.user = signedInUser;
    renderToggle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchCalls.find((c) => c.method === "PATCH")).toBeDefined());
    const patch = fetchCalls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toMatch(/\/api\/account\/profile$/);
    expect(patch.body).toEqual({ locale: "en" });
  });

  test("signed-out user click does NOT call /api/account/profile", async () => {
    renderToggle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(fetchCalls.find((c) => c.url.includes("/api/account/profile"))).toBeUndefined();
  });

  test("PATCH failure: UI stays in the new locale and aria-live error is populated", async () => {
    mockAuth.isAuthenticated = true;
    mockAuth.user = signedInUser;
    nextResponse = { status: 500, body: { error: "boom" } };
    renderToggle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(i18n.language).toBe("en"));
    await waitFor(() =>
      expect(
        screen.getByTestId("locale-toggle-server-error").textContent?.length ?? 0,
      ).toBeGreaterThan(0),
    );
  });

  test("regression: signed-in toggle updates ['auth','session'] cache so useAuth does not revert locale", async () => {
    mockAuth.isAuthenticated = true;
    mockAuth.user = signedInUser;
    nextResponse = {
      status: 200,
      body: { data: { ...signedInUser, locale: "en" } },
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed the cache with the pre-toggle session — this is what `useAuth` reads.
    client.setQueryData(["auth", "session"], { ...signedInUser });

    const { unmount } = render(
      <QueryClientProvider client={client}>
        <LocaleToggle />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(i18n.language).toBe("en"));

    // Optimistic update MUST have written the new locale into cache so
    // useAuth's `useEffect(() => i18n.changeLanguage(user.locale))`
    // doesn't bounce us back to zh-TW on the next render.
    const cached = client.getQueryData<{ locale: string }>(["auth", "session"]);
    expect(cached?.locale).toBe("en");

    // Simulate a re-mount with the SAME QueryClient — emulates the user
    // navigating to a different route. The locale must remain `en`.
    unmount();
    render(
      <QueryClientProvider client={client}>
        <LocaleToggle />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button").textContent).toContain("EN");
    expect(i18n.language).toBe("en");
  });
});
