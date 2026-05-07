/**
 * performLogout — pure side-effect orchestration for sign-out.
 *
 * Sequence is fixed:
 *   1. signOut   — POST /api/auth/sign-out (server clears the cookie)
 *   2. navigate  — hard navigate to `/` (landing page).
 *
 * No client-side cache reset: hard navigation reloads the whole app,
 * which discards Zustand / React Query / i18n state. Resetting the
 * React Query cache *before* navigating creates a flash of the
 * `/login` route because `RouteGuard` sees `user=null` between the
 * cache reset and the navigation. Skipping it eliminates the race.
 *
 * Dependency-injected so it can be unit-tested without a browser.
 */

export interface LogoutDeps {
  signOut: () => Promise<void>;
  navigate: (href: string) => void;
}

export async function performLogout(deps: LogoutDeps): Promise<void> {
  await deps.signOut();
  deps.navigate("/");
}
