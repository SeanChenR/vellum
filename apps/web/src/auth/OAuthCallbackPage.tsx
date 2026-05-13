/**
 * OAuthCallbackPage — handles the redirect from Google OAuth.
 *
 * better-auth processes the callback server-side and redirects here after
 * setting the session cookie. On success we redirect to /dashboard;
 * on error we redirect to /login?error=googleOauthFailed.
 */

import { Navigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface OAuthCallbackSearch {
  error?: string;
}

export function OAuthCallbackPage() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as OAuthCallbackSearch;
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (search.error) {
      setTarget(`/login?error=googleOauthFailed`);
    } else {
      // better-auth should have set the session cookie already.
      // Redirect to dashboard.
      setTarget("/dashboard");
    }
  }, [search.error]);

  if (!target) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-text-muted">{t("auth.verify.verifying")}</span>
      </div>
    );
  }

  return <Navigate to={target} />;
}
