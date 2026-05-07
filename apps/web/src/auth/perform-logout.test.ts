/**
 * performLogout tests.
 *
 * Verifies sign-out side-effects fire in the right order, navigation
 * target is `/` (never `/login`), and no client-side cache reset
 * happens between sign-out and navigate (avoids the `/login` flash
 * caused by `RouteGuard` seeing `user=null` mid-flight).
 */

import { describe, expect, mock, test } from "bun:test";

import { performLogout } from "./perform-logout";

describe("performLogout", () => {
  test("navigates to landing page (/) — never to /login", async () => {
    const navigate = mock((_href: string) => {});

    await performLogout({
      signOut: async () => {},
      navigate,
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/");
  });

  test("calls signOut → navigate in that order", async () => {
    const order: string[] = [];

    await performLogout({
      signOut: async () => {
        order.push("signOut");
      },
      navigate: (href) => {
        order.push(`navigate:${href}`);
      },
    });

    expect(order).toEqual(["signOut", "navigate:/"]);
  });

  test("awaits signOut before navigating (server cookie cleared first)", async () => {
    let signOutResolved = false;
    let navigatedBeforeSignOutResolved = false;

    await performLogout({
      signOut: async () => {
        await Promise.resolve();
        signOutResolved = true;
      },
      navigate: () => {
        if (!signOutResolved) navigatedBeforeSignOutResolved = true;
      },
    });

    expect(navigatedBeforeSignOutResolved).toBe(false);
  });
});
