/**
 * Navbar.test.tsx — three-region grid + new chrome controls.
 *
 * Spec ref: openspec/specs/public-pages/spec.md
 *   "Navbar exposes product identity and primary navigation"
 *   scenarios: "NavBar regions render in the correct order",
 *              "Loading state does not shift layout",
 *              "Active route link is visually distinguished"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as RealRouter from "@tanstack/react-router";
import i18n from "../i18n";
import type { AuthUser } from "../auth/useAuth";

// `Link` from TanStack Router blows up without a RouterProvider; the
// rest of the module we want to keep (so other test files importing
// e.g. `useNavigate` still resolve). Replace only Link with a plain
// anchor and pass through everything else.
mock.module("@tanstack/react-router", () => ({
  ...RealRouter,
  Link: (props: {
    to: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={props.to} className={props.className} aria-label={props["aria-label"]}>
      {props.children}
    </a>
  ),
}));

interface MockAuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

let mockAuth: MockAuthState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
};

mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    ...mockAuth,
    logout: mock(() => {}),
  }),
}));

function setMockPathname(path: string) {
  window.history.replaceState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const fakeUser: AuthUser = {
  id: "u-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  locale: "en",
  createdAt: new Date().toISOString(),
};

const { Navbar } = await import("./Navbar");

function renderNavbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <Navbar />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockAuth = { user: null, isLoading: false, isAuthenticated: false };
  setMockPathname("/");
});

afterEach(() => cleanup());

describe("Navbar — layout structure", () => {
  test("renders three grid regions in left/center/right DOM order", () => {
    mockAuth = { user: fakeUser, isLoading: false, isAuthenticated: true };
    const { container } = renderNavbar();
    const inner = container.querySelector('[data-testid="navbar-inner"]') as HTMLElement;
    expect(inner).not.toBeNull();
    // grid-cols-[1fr_auto_1fr] declares three columns.
    expect(inner.className).toContain("grid-cols-[1fr_auto_1fr]");
    const regions = inner.querySelectorAll("[data-region]");
    expect(regions).toHaveLength(3);
    expect((regions[0] as HTMLElement).getAttribute("data-region")).toBe("brand");
    expect((regions[1] as HTMLElement).getAttribute("data-region")).toBe("nav-links");
    expect((regions[2] as HTMLElement).getAttribute("data-region")).toBe("chrome-controls");
  });

  test("chrome-controls right region contains LocaleToggle, ThemeToggle, then auth action in order", () => {
    mockAuth = { user: fakeUser, isLoading: false, isAuthenticated: true };
    const { container } = renderNavbar();
    const right = container.querySelector('[data-region="chrome-controls"]') as HTMLElement;
    const localeBtn = right.querySelector('[data-testid="locale-toggle-label"]');
    const themeIcon = right.querySelector('[data-testid^="theme-toggle-icon-"]');
    const userMenu = right.querySelector('[aria-label*="user menu" i]');
    expect(localeBtn).not.toBeNull();
    expect(themeIcon).not.toBeNull();
    expect(userMenu).not.toBeNull();
    const elements = [localeBtn!, themeIcon!, userMenu!];
    for (let i = 0; i < elements.length - 1; i++) {
      const a = elements[i] as HTMLElement;
      const b = elements[i + 1] as HTMLElement;
      const cmp = a.compareDocumentPosition(b);
      expect(cmp & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("Navbar — active route highlighting", () => {
  test("active link gets accent-purple underline class when pathname matches", () => {
    setMockPathname("/about");
    const { container } = renderNavbar();
    const aboutLink = container.querySelector('a[href="/about"]') as HTMLElement;
    expect(aboutLink.className).toContain("nav-link-active");
  });

  test("non-active link does NOT get the active class", () => {
    setMockPathname("/");
    const { container } = renderNavbar();
    const aboutLink = container.querySelector('a[href="/about"]') as HTMLElement;
    expect(aboutLink.className).not.toContain("nav-link-active");
  });
});

describe("Navbar — anonymous visitor", () => {
  test("renders brand link to / + About link + Sign-in CTA", () => {
    const { container } = renderNavbar();
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/about"]')).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
  });

  test("does NOT render any user-avatar menu", () => {
    renderNavbar();
    expect(screen.queryByRole("button", { name: /user menu/i })).toBeNull();
  });
});

describe("Navbar — authenticated visitor", () => {
  test("renders user-avatar menu + NO Sign-in CTA", () => {
    mockAuth = { user: fakeUser, isLoading: false, isAuthenticated: true };
    const { container } = renderNavbar();
    expect(screen.getByRole("button", { name: /user menu/i })).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
  });
});

describe("Navbar — auth loading", () => {
  test("renders placeholder with the same width-related classes as the Sign-in CTA", () => {
    mockAuth = { user: null, isLoading: false, isAuthenticated: false };
    const { container: anon, unmount } = renderNavbar();
    const cta = anon.querySelector('a[href="/login"]') as HTMLElement;
    const widthTokens = cta.className.split(/\s+/).filter((c) => /^(px-|py-|w-|h-)/.test(c));
    unmount();

    mockAuth = { user: null, isLoading: true, isAuthenticated: false };
    const { container: loading } = renderNavbar();
    const placeholder = loading.querySelector(
      '[data-testid="navbar-auth-placeholder"]',
    ) as HTMLElement;
    expect(placeholder).not.toBeNull();
    for (const tok of widthTokens) {
      expect(placeholder.className).toContain(tok);
    }
  });
});
