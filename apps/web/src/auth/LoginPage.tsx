/**
 * LoginPage — Google OAuth + Magic Link sign-in.
 *
 * - Google OAuth button: <a href="/api/auth/sign-in/social?provider=google">
 * - Magic Link form: email input + submit → POST /api/auth/sign-in/magic-link
 * - Error state displays i18n key from server errorKey
 * - Post-submit: shows "check your inbox" message
 *
 * Visual styling is iterative (preview-based); logic is TDD-covered.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "./useAuth";
import { safeRedirect } from "./safe-redirect";
import vellumLogo from "../assets/vellum-logo.png";

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

interface MagicLinkResponse {
  data?: { sent: boolean };
  error?: { errorKey: string };
}

export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const [sent, setSent] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // After a successful sign-in, better-auth redirects the browser to
  // `callbackURL`. We bounce through the frontend `/post-login` route rather
  // than handing it an arbitrary same-origin path (e.g. an API endpoint),
  // because better-auth restricts callbackURL handling to known frontend
  // routes and an API endpoint as a landing page is poor UX. PostLoginPage
  // reads `?next=` and forwards via window.location for any same-origin
  // path, including server endpoints like /api/share/invite/<t>/accept.
  const search = useSearch({ strict: false }) as { redirect?: string };
  const safeRequested = safeRedirect(search.redirect, "");
  const callbackURL = safeRequested
    ? `/post-login?next=${encodeURIComponent(safeRequested)}`
    : "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Already-signed-in visitors skip the login form entirely.
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="text-warm-sepia">Loading…</span>
      </main>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  const onSubmit = async (values: FormValues) => {
    setErrorKey(null);
    try {
      const resp = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: values.email, callbackURL }),
      });
      const body = (await resp.json()) as MagicLinkResponse;
      if (!resp.ok) {
        setErrorKey(body.error?.errorKey ?? "auth.errors.magicLinkSendFailed");
        return;
      }
      setSent(true);
    } catch {
      setErrorKey("auth.errors.magicLinkSendFailed");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Title */}
        <div className="flex flex-col items-center text-center">
          <img
            src={vellumLogo}
            alt={t("app.name")}
            className="h-14 w-14 select-none"
            draggable={false}
          />
          <h1 className="mt-3 font-serif text-3xl text-ink-navy">{t("app.name")}</h1>
          <p className="mt-2 text-sm text-warm-sepia">{t("auth.login.subtitle")}</p>
        </div>

        {/* Google OAuth Button — POST to /sign-in/social, follow returned redirect URL */}
        <button
          type="button"
          onClick={async () => {
            setErrorKey(null);
            try {
              const resp = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ provider: "google", callbackURL }),
              });
              const body = (await resp.json()) as { url?: string; error?: { errorKey?: string } };
              if (body.url) {
                window.location.href = body.url;
                return;
              }
              setErrorKey(body.error?.errorKey ?? "auth.errors.googleOauthFailed");
            } catch {
              setErrorKey("auth.errors.googleOauthFailed");
            }
          }}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium transition hover:bg-gray-50"
          aria-label="Google"
        >
          <GoogleIcon />
          {t("auth.login.googleButton")}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400">
            <span className="bg-white px-2">{t("auth.login.magicLinkLabel")}</span>
          </div>
        </div>

        {/* Magic Link Form */}
        {sent ? (
          <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-800">
            {t("auth.login.checkEmail")}
          </div>
        ) : (
          <form
            aria-label="magic-link-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                {t("auth.login.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.login.emailPlaceholder")}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ink-navy focus:ring-1 focus:ring-ink-navy"
                {...register("email")}
              />
            </div>

            {errorKey && (
              <p data-testid="auth-error" className="text-sm text-red-600">
                {t(errorKey, { defaultValue: errorKey })}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-ink-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {t("auth.login.sendLinkButton")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.68 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.34-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 14.12l7.34 5.7c1.74-5.2 6.59-10.07 12.32-10.07z"
      />
    </svg>
  );
}
