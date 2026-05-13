/**
 * ProfilePage — thin re-export wrapper that preserves the legacy import
 * path `./ProfilePage` while the canonical implementation now lives in
 * `./ProfileTab` (rendered inside the `/account` tab shell).
 *
 * The route `/account/profile` is handled by `ProfileRouteRedirect` in
 * `legacy-redirects.tsx`; this re-export only exists so other modules
 * (and existing tests) that import `ProfilePage` keep compiling.
 */

export { ProfileTab as ProfilePage } from "./ProfileTab";
