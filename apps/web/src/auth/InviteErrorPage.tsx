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

import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
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
    <main className="flex flex-1 items-center justify-center p-8">
      <Card
        variant="elevated"
        className="w-full max-w-[460px] !p-10 text-center"
        style={{ borderTop: "3px solid var(--accent-orange)" }}
      >
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-orange/10 text-accent-orange">
          <AlertTriangle size={26} aria-hidden />
        </div>
        <h1 className="mb-2 font-serif text-2xl font-medium text-text-primary">
          {t("inviteError.title")}
        </h1>
        <p className="text-sm leading-relaxed text-text-muted" style={{ textWrap: "pretty" }}>
          {bodyByReason[reason]}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {canSwitch && (
            <Button variant="primary" size="md" onClick={handleSwitch} disabled={busy}>
              {t("inviteError.switchAccount")}
            </Button>
          )}
          <a
            href="/"
            className="focus-visible-ring rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-text-primary hover:border-accent-purple hover:text-accent-purple"
          >
            {t("inviteError.backHome")}
          </a>
        </div>
      </Card>
    </main>
  );
}
