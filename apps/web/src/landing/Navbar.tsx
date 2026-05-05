/**
 * Navbar — auth-aware public-page header.
 *
 * Spec: public-pages — "Navbar exposes product identity and primary
 * navigation". Logo + About link are constant; the right-side action
 * area switches on `useAuth()`:
 *   - isLoading=true  → fixed-width placeholder (no CLS)
 *   - isAuthenticated=false → Sign-in CTA → /login
 *   - isAuthenticated=true  → UserAvatarMenu
 *
 * The same Navbar instance is reused on Homepage, About, Login,
 * Dashboard, Profile, and Sessions routes (canvas editor keeps its
 * own TopBar).
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { UserAvatarMenu } from "../components/UserAvatarMenu";
import vellumLogo from "../assets/vellum-logo-removebg.png";

// Shared sizing classes — applied to BOTH the Sign-in CTA and the loading
// placeholder so toggling between auth states does not produce layout shift
// (CLS). Visual styles (bg / text colour / hover) live on the CTA only.
const AUTH_ACTION_SIZE_CLASSES = "inline-flex items-center justify-center px-4 py-2";

export function Navbar() {
  const { t } = useTranslation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  return (
    <nav
      aria-label={t("nav.brand")}
      className="sticky top-0 z-40 w-full border-b border-ink-navy/5 bg-off-white/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a
          href="/"
          className="focus-visible-ring flex items-center gap-2 rounded-lg text-ink-navy hover:opacity-80 transition-opacity"
          aria-label={t("nav.brand")}
        >
          <img
            src={vellumLogo}
            alt={t("nav.brand")}
            className="h-7 w-7 select-none"
            draggable={false}
          />
          <span className="font-serif text-lg font-semibold tracking-tight">{t("nav.brand")}</span>
        </a>

        <div className="flex items-center gap-8">
          <a
            href="/about"
            className="focus-visible-ring rounded-lg px-1 text-sm text-warm-sepia hover:text-ink-navy transition-colors cursor-pointer"
          >
            {t("nav.about")}
          </a>
          <AuthAction
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            user={user}
            onSignOut={logout}
            ctaLabel={t("nav.login")}
          />
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// AuthAction — three-state right-side: loading / Sign-in CTA / avatar menu
// ---------------------------------------------------------------------------

interface AuthActionProps {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: ReturnType<typeof useAuth>["user"];
  onSignOut: () => void;
  ctaLabel: string;
}

function AuthAction({ isLoading, isAuthenticated, user, onSignOut, ctaLabel }: AuthActionProps) {
  if (isLoading) {
    return (
      <div
        data-testid="navbar-auth-placeholder"
        aria-hidden="true"
        className={`${AUTH_ACTION_SIZE_CLASSES} rounded-lg bg-transparent`}
      >
        <span className="invisible text-sm font-medium">{ctaLabel}</span>
      </div>
    );
  }
  if (isAuthenticated && user) {
    return <UserAvatarMenu user={user} onSignOut={onSignOut} />;
  }
  return (
    <a
      href="/login"
      className={`${AUTH_ACTION_SIZE_CLASSES} focus-visible-ring cursor-pointer rounded-lg bg-ink-navy text-sm font-medium text-white hover:bg-ink-navy/90 transition-colors`}
    >
      {ctaLabel}
    </a>
  );
}
