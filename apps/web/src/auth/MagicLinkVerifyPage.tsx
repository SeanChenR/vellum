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
import { Mail } from "lucide-react";
import { Card } from "../components/ui/Card";

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
      <main className="flex flex-1 items-center justify-center p-6">
        <Card variant="elevated" className="w-full max-w-[460px] !p-10 text-center">
          <div
            data-testid="verify-mail-icon"
            className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-purple/10 text-accent-purple"
          >
            <Mail size={26} aria-hidden />
          </div>
          <h2 className="mb-2 font-serif text-2xl font-medium text-text-primary">
            {t("auth.verify.verifying")}
          </h2>
          <p data-testid="verify-error" className="mb-4 text-sm text-accent-red">
            {t(errorKey, { defaultValue: errorKey })}
          </p>
          <a
            href="/login"
            className="focus-visible-ring inline-block text-sm font-semibold text-accent-purple underline-offset-4 hover:underline"
          >
            {t("auth.login.backToLogin")}
          </a>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card variant="elevated" className="w-full max-w-[460px] !p-10 text-center">
        <div
          data-testid="verify-mail-icon"
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-purple/10 text-accent-purple"
        >
          <Mail size={26} aria-hidden />
        </div>
        <h2 className="mb-2 font-serif text-2xl font-medium text-text-primary">
          {t("auth.verify.verifying")}
        </h2>
        <div className="mx-auto mt-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted">
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-2 border-accent-cyan border-r-transparent"
          />
          <span>{t("auth.verify.verifying")}</span>
        </div>
      </Card>
    </main>
  );
}
