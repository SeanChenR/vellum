/**
 * PostLoginPage — frontend bounce after better-auth verifies the user.
 *
 * better-auth's magicLink / OAuth callback set the session cookie and
 * redirect to `callbackURL`. We always set callbackURL to
 * `/post-login?next=<encoded-path>` so:
 *   - the landing route is a real frontend page (better-auth's callbackURL
 *     handling is happiest with frontend routes), and
 *   - we get one safeRedirect-validated hop before landing on the
 *     destination, which can be a server endpoint such as
 *     /api/share/invite/<token>/accept (where TanStack Router can't go).
 *
 * The `next` value is re-validated here even though LoginPage already
 * called `safeRedirect` — defence-in-depth: anyone constructing a
 * /post-login URL directly should not be able to bypass the check.
 *
 * Spec: sharing — invite-flow auth bounce (Bug 2 follow-up).
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { safeRedirect } from "./safe-redirect";

export interface PostLoginPageProps {
  /** Override for tests; production uses `window.location.assign`. */
  navigate?: (href: string) => void;
  /** Override for tests; production reads window.location.search. */
  searchOverride?: string;
}

function readNext(searchOverride: string | undefined): string | undefined {
  const raw =
    searchOverride !== undefined
      ? searchOverride
      : typeof window === "undefined"
        ? ""
        : window.location.search;
  const next = new URLSearchParams(raw).get("next");
  return next ?? undefined;
}

export function PostLoginPage({ navigate, searchOverride }: PostLoginPageProps = {}) {
  const { t } = useTranslation();
  const target = safeRedirect(readNext(searchOverride));

  useEffect(() => {
    const go = navigate ?? ((href: string) => window.location.assign(href));
    go(target);
  }, [target, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <span className="text-warm-sepia">{t("auth.verify.verifying")}</span>
    </main>
  );
}
