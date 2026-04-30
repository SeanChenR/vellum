/**
 * AppHeader — global top-of-page header for authenticated routes
 * (dashboard + account pages).
 *
 * Layout: clickable Vellum logo (back to /dashboard) on the left,
 * UserAvatarMenu on the right.
 *
 * Not used on the in-canvas /canvas/:id page — that page has its own
 * TopBar with breadcrumb + share button.
 */

import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import vellumLogo from "../assets/vellum-logo.png";
import { UserAvatarMenu } from "./UserAvatarMenu";

export function AppHeader() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-navy/10 bg-white px-4">
      <a
        href="/dashboard"
        className="flex items-center gap-2 rounded-md px-1 hover:bg-parchment-cream"
        aria-label={t("nav.backToDashboard")}
      >
        <img
          src={vellumLogo}
          alt={t("app.name")}
          className="h-8 w-8 select-none"
          draggable={false}
        />
        <span className="font-serif text-base text-ink-navy">{t("app.name")}</span>
      </a>
      <div className="ml-auto">
        <UserAvatarMenu user={user} onSignOut={logout} />
      </div>
    </header>
  );
}
