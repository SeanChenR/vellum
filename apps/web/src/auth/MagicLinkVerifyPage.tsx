/**
 * MagicLinkVerifyPage — receives magic-link clicks from email.
 *
 * better-auth's verify endpoint (GET /api/auth/magic-link/verify?token=...)
 * sets the session cookie and redirects to /dashboard on success.
 * This page handles error fallbacks when the redirect doesn't happen.
 */

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface VerifySearch {
  token?: string;
}

interface VerifyResponse {
  data?: object;
  error?: { errorKey: string };
}

export function MagicLinkVerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as VerifySearch;
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const token = search.token;
    if (!token) {
      setErrorKey("auth.errors.invalidCredentials");
      return;
    }

    void (async () => {
      try {
        const resp = await fetch(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`);

        if (resp.ok || resp.redirected) {
          void navigate({ to: "/dashboard" });
          return;
        }

        const body = (await resp.json().catch(() => ({}))) as VerifyResponse;
        setErrorKey(body.error?.errorKey ?? "auth.errors.invalidCredentials");
      } catch {
        setErrorKey("auth.errors.invalidCredentials");
      }
    })();
  }, [search.token, navigate]);

  if (errorKey) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p data-testid="verify-error" className="text-red-600">
            {t(errorKey, { defaultValue: errorKey })}
          </p>
          <a href="/login" className="mt-4 block text-sm text-ink-navy underline">
            {t("auth.login.backToLogin")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <span className="text-warm-sepia">{t("auth.verify.verifying")}</span>
    </main>
  );
}
