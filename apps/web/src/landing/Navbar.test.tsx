/**
 * Navbar tests — public-pages spec "Navbar exposes product identity
 * and primary navigation" (auth-aware right side after unify-navbar).
 *
 * Three render modes by `useAuth()`:
 *   - isLoading=true  → fixed-width placeholder, no Sign-in, no avatar
 *   - isAuthenticated=false → Sign-in CTA visible, avatar absent
 *   - isAuthenticated=true  → UserAvatarMenu rendered, Sign-in absent
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import type { AuthUser } from "../auth/useAuth";

// ---------------------------------------------------------------------------
// Mocks — must come before importing the component under test
// ---------------------------------------------------------------------------

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

const fakeUser: AuthUser = {
  id: "u-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  locale: "en",
  createdAt: new Date().toISOString(),
};

const { Navbar } = await import("./Navbar");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderNavbar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Navbar />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockAuth = { user: null, isLoading: false, isAuthenticated: false };
});

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Anonymous visitor (the original spec scenarios)
// ---------------------------------------------------------------------------

describe("Navbar — anonymous visitor", () => {
  test("renders the brand logo wrapped in a link to /", () => {
    const { container } = renderNavbar();
    expect(container.querySelectorAll('a[href="/"]').length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/"] img')).not.toBeNull();
  });

  test("renders an About link to /about with the localized label", () => {
    const { container } = renderNavbar();
    expect(container.querySelector('a[href="/about"]')).not.toBeNull();
    expect(screen.getByText("About")).not.toBeNull();
  });

  test("renders a Sign-in CTA pointing to /login", () => {
    const { container } = renderNavbar();
    const login = container.querySelector('a[href="/login"]');
    expect(login).not.toBeNull();
    expect(screen.getByText("Sign in")).not.toBeNull();
  });

  test("does NOT render any user-avatar menu", () => {
    renderNavbar();
    expect(screen.queryByRole("button", { name: /user menu/i })).toBeNull();
  });

  test("renders the brand name from nav.brand i18n key", () => {
    renderNavbar();
    expect(screen.getAllByText("Vellum").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Authenticated visitor — avatar menu replaces Sign-in CTA
// ---------------------------------------------------------------------------

describe("Navbar — authenticated visitor", () => {
  test("renders the user-avatar menu and NO Sign-in CTA", () => {
    mockAuth = { user: fakeUser, isLoading: false, isAuthenticated: true };
    const { container } = renderNavbar();
    expect(screen.getByRole("button", { name: /user menu/i })).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  test("logo still links to /", () => {
    mockAuth = { user: fakeUser, isLoading: false, isAuthenticated: true };
    const { container } = renderNavbar();
    const logoLinks = container.querySelectorAll('a[href="/"]');
    expect(logoLinks.length).toBeGreaterThan(0);
  });

  test("About link still present", () => {
    mockAuth = { user: fakeUser, isLoading: false, isAuthenticated: true };
    const { container } = renderNavbar();
    expect(container.querySelector('a[href="/about"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auth state still loading — fixed-width placeholder, no CLS
// ---------------------------------------------------------------------------

describe("Navbar — auth loading", () => {
  test("renders a placeholder element instead of Sign-in CTA or avatar", () => {
    mockAuth = { user: null, isLoading: true, isAuthenticated: false };
    const { container } = renderNavbar();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /user menu/i })).toBeNull();
    // Placeholder is identifiable via data attribute set by Navbar.
    const placeholder = container.querySelector('[data-testid="navbar-auth-placeholder"]');
    expect(placeholder).not.toBeNull();
  });

  test("placeholder dimensions match the Sign-in CTA classes (no CLS)", () => {
    // Render anonymous first, capture CTA element.
    mockAuth = { user: null, isLoading: false, isAuthenticated: false };
    const { container: anonContainer, unmount } = renderNavbar();
    const cta = anonContainer.querySelector('a[href="/login"]') as HTMLElement;
    expect(cta).not.toBeNull();
    const ctaClasses = cta.className;
    unmount();

    // Re-render with isLoading=true and check placeholder shares the
    // size-affecting classes (px / py / inline-flex). Compare on length-bearing
    // tokens to remain resilient to non-size class additions.
    mockAuth = { user: null, isLoading: true, isAuthenticated: false };
    const { container: loadingContainer } = renderNavbar();
    const placeholder = loadingContainer.querySelector(
      '[data-testid="navbar-auth-placeholder"]',
    ) as HTMLElement;
    expect(placeholder).not.toBeNull();
    const tokensFromCta = ctaClasses.split(/\s+/).filter((c) => /^(px-|py-|w-|h-)/.test(c));
    for (const tok of tokensFromCta) {
      expect(placeholder.className).toContain(tok);
    }
  });
});
