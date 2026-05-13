/**
 * legacy-redirects tests — design Decision 10 / spec account ADDED
 * Requirement "Account settings live under a single tabbed route"
 * scenario "Legacy /account/profile redirects to tab".
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

const mockNavigate = mock((_args: unknown) => {});

const RealRouter = await import("@tanstack/react-router");
mock.module("@tanstack/react-router", () => ({
  ...RealRouter,
  useNavigate: () => mockNavigate,
}));

const { ApiKeysRouteRedirect, ProfileRouteRedirect, SessionsRouteRedirect } =
  await import("./legacy-redirects");

beforeEach(() => {
  mockNavigate.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("legacy-redirects", () => {
  test("ProfileRouteRedirect navigates to /account?tab=profile with replace=true", () => {
    render(<ProfileRouteRedirect />);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/account",
      search: { tab: "profile" },
      replace: true,
    });
  });

  test("SessionsRouteRedirect navigates to /account?tab=sessions", () => {
    render(<SessionsRouteRedirect />);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/account",
      search: { tab: "sessions" },
      replace: true,
    });
  });

  test("ApiKeysRouteRedirect navigates to /account?tab=api-keys", () => {
    render(<ApiKeysRouteRedirect />);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/account",
      search: { tab: "api-keys" },
      replace: true,
    });
  });

  test("each redirect component renders no DOM (null)", () => {
    const { container } = render(<ProfileRouteRedirect />);
    expect(container.firstChild).toBeNull();
  });
});
