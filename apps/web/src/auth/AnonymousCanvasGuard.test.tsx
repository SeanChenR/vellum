/**
 * AnonymousCanvasGuard tests (task 4.3).
 *
 * Spec: sharing — "Anonymous visitors enter via public link without login redirect"
 *
 * Three branches:
 *   1. has user → render children regardless of token
 *   2. no user + has ?share token → render children (anonymous path)
 *   3. no user + no token → redirect /login?redirect=<original>
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";

// ---------------------------------------------------------------------------
// Mocks — useAuth + window.location
// ---------------------------------------------------------------------------

let mockUser: {
  id: string;
  email: string;
  name: string;
  image: null;
  locale: "en";
  createdAt: string;
} | null = null;
let mockIsLoading = false;

mock.module("./useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
    isLoading: mockIsLoading,
    logout: mock(async () => {}),
  }),
}));

const navigateCalls: string[] = [];
function setLocation(href: string) {
  // Reset href on the existing happy-dom location.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(href),
    writable: true,
  });
}

const { AnonymousCanvasGuard } = await import("./AnonymousCanvasGuard");

beforeEach(() => {
  mockUser = null;
  mockIsLoading = false;
  navigateCalls.length = 0;
  setLocation("http://localhost/canvas/c1");
});

afterEach(() => {
  cleanup();
});

function renderGuard(redirectFn?: (href: string) => void) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AnonymousCanvasGuard
        redirect={
          redirectFn ??
          ((href: string) => {
            navigateCalls.push(href);
          })
        }
      >
        <div data-testid="canvas-content">canvas content</div>
      </AnonymousCanvasGuard>
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

describe("AnonymousCanvasGuard", () => {
  test("logged-in user renders children regardless of token presence", () => {
    mockUser = {
      id: "u1",
      email: "u@x.com",
      name: "User",
      image: null,
      locale: "en",
      createdAt: new Date().toISOString(),
    };
    renderGuard();
    expect(screen.getByTestId("canvas-content")).not.toBeNull();
    expect(navigateCalls).toEqual([]);
  });

  test("anonymous + has ?share token renders children (no redirect)", () => {
    mockUser = null;
    setLocation("http://localhost/canvas/c1?share=abc123");
    renderGuard();
    expect(screen.queryByTestId("canvas-content")).not.toBeNull();
    expect(navigateCalls).toEqual([]);
  });

  test("anonymous + no token redirects to /login with the original URL encoded", () => {
    mockUser = null;
    setLocation("http://localhost/canvas/c1");
    renderGuard();
    expect(screen.queryByTestId("canvas-content")).toBeNull();
    expect(navigateCalls).toHaveLength(1);
    expect(navigateCalls[0]).toBe(`/login?redirect=${encodeURIComponent("/canvas/c1")}`);
  });

  test("auth still loading renders nothing (no premature redirect)", () => {
    mockUser = null;
    mockIsLoading = true;
    setLocation("http://localhost/canvas/c1");
    renderGuard();
    expect(screen.queryByTestId("canvas-content")).toBeNull();
    expect(navigateCalls).toEqual([]);
  });
});
