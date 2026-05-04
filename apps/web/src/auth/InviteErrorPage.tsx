/**
 * InviteErrorPage — friendly landing for invite-accept failures.
 *
 * The server's `/api/share/invite/:token/accept` endpoint redirects here
 * (302) instead of returning raw JSON when an invite cannot be accepted:
 *   - reason=email_mismatch&expected=<email>&token=<inviteToken>
 *   - reason=expired
 *   - reason=not_found
 *
 * For email_mismatch, the page surfaces a "switch account" action that
 * signs the current user out and redirects them to /login with the original
 * accept URL as the post-login redirect — letting them retry with the
 * correct account in one tap. Other reasons just show an explanation +
 * a back-to-home link.
 *
 * Logic is TDD-covered (auth/InviteErrorPage.test.tsx); the visual layout
 * follows LoginPage's centered-card aesthetic.
 *
 * Spec: sharing — invite acceptance error UX (PRD: "未註冊帳號收到 invite
 * 點 link 應引導，不應裸 JSON").
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";

type InviteErrorReason = "email_mismatch" | "expired" | "not_found" | "unknown";

function parseReason(raw: string | null): InviteErrorReason {
  if (raw === "email_mismatch" || raw === "expired" || raw === "not_found") return raw;
  return "unknown";
}

function readSearch(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export interface InviteErrorPageProps {
  /** Override for tests; production uses `useAuth().logout`. */
  logout?: () => Promise<void>;
  /** Override for tests; production uses `window.location.assign`. */
  navigate?: (href: string) => void;
}

export function InviteErrorPage({ logout: logoutOverride, navigate }: InviteErrorPageProps = {}) {
  const { t } = useTranslation();
  const { logout: logoutFromAuth } = useAuth();
  const logout = logoutOverride ?? logoutFromAuth;
  const [busy, setBusy] = useState(false);

  const params = readSearch();
  const reason = parseReason(params.get("reason"));
  const expected = params.get("expected") ?? "";
  const token = params.get("token") ?? "";

  const bodyByReason: Record<InviteErrorReason, ReactNode> = {
    email_mismatch: t("inviteError.emailMismatchBody", { expected }),
    expired: t("inviteError.expiredBody"),
    not_found: t("inviteError.notFoundBody"),
    unknown: t("inviteError.unknownBody"),
  };

  const canSwitch = reason === "email_mismatch" && token.length > 0;

  async function handleSwitch() {
    if (!canSwitch || busy) return;
    setBusy(true);
    try {
      await logout();
    } finally {
      const acceptUrl = `/api/share/invite/${token}/accept`;
      const target = `/login?redirect=${encodeURIComponent(acceptUrl)}`;
      const go = navigate ?? ((href: string) => window.location.assign(href));
      go(target);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-50 p-8">
      <div className="w-full max-w-md rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-ink-navy">{t("inviteError.title")}</h1>
        <p className="mt-4 text-sm leading-relaxed text-warm-sepia">{bodyByReason[reason]}</p>
        <div className="mt-8 flex flex-col gap-3">
          {canSwitch && (
            <button
              type="button"
              onClick={handleSwitch}
              disabled={busy}
              className="rounded-lg bg-ink-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-navy/90 disabled:opacity-50"
            >
              {t("inviteError.switchAccount")}
            </button>
          )}
          <a
            href="/"
            className="rounded-lg border border-warm-200 px-4 py-2.5 text-center text-sm font-semibold text-ink-navy hover:bg-warm-50"
          >
            {t("inviteError.backHome")}
          </a>
        </div>
      </div>
    </main>
  );
}
