/**
 * Navbar — Aura redesign three-region grid.
 *
 *   ┌─────────────────┬───────────────────────────┬──────────────────────┐
 *   │ brand (left 1fr) │ nav links (center auto)   │ chrome (right 1fr)   │
 *   │ logo + Vellum   │ Home · About              │ Locale · Theme · auth │
 *   └─────────────────┴───────────────────────────┴──────────────────────┘
 *
 * Right region order: <LocaleToggle /> · <ThemeToggle /> · auth action.
 * The auth action is one of: avatar menu (signed in), Sign-in CTA
 * (signed out), or a fixed-width placeholder (auth loading) so the
 * navbar does not shift when auth resolves.
 *
 * Spec ref: openspec/specs/public-pages/spec.md
 *   "Navbar exposes product identity and primary navigation"
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../auth/useAuth";
import { UserAvatarMenu } from "../components/UserAvatarMenu";
import { ThemeToggle } from "../theme/ThemeToggle";
import { LocaleToggle } from "../i18n/LocaleToggle";
import vellumLogo from "../assets/vellum-logo-removebg.png";

/**
 * Read the current pathname without depending on TanStack Router
 * context. Avoids forcing every test that mounts Navbar (e.g.
 * AppLayout / PublicLayout / per-route page tests) to wire up a real
 * RouterProvider just to derive active-route styling.
 */
function usePathname(): string {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return pathname;
}

// Width-bearing classes shared between the Sign-in CTA and the auth
// loading placeholder so toggling between them produces zero CLS.
const AUTH_ACTION_SIZE_CLASSES = "inline-flex h-9 items-center justify-center px-4";

interface NavLinkProps {
  to: "/" | "/about";
  label: string;
  active: boolean;
}

function NavLink({ to, label, active }: NavLinkProps) {
  const base =
    "focus-visible-ring relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors";
  const activeCls =
    "nav-link-active text-text-primary after:absolute after:left-3.5 after:right-3.5 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent-purple after:content-['']";
  const inactive = "text-text-muted hover:text-accent-purple";
  return (
    <Link to={to} className={`${base} ${active ? activeCls : inactive}`}>
      {label}
    </Link>
  );
}

export function Navbar() {
  const { t } = useTranslation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.brand")}
      className="sticky top-0 z-40 w-full border-b border-border bg-bg/85 backdrop-blur"
    >
      <div
        data-testid="navbar-inner"
        className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-3 md:px-8"
      >
        <div data-region="brand" className="flex items-center">
          <Link
            to="/"
            aria-label={t("nav.brand")}
            className="focus-visible-ring flex items-center gap-2 rounded-lg text-text-primary transition-opacity hover:opacity-80"
          >
            <img
              src={vellumLogo}
              alt={t("nav.brand")}
              className="h-7 w-7 select-none"
              draggable={false}
            />
            <span className="font-serif text-lg font-semibold tracking-tight">
              {t("nav.brand")}
            </span>
          </Link>
        </div>

        <div data-region="nav-links" className="flex items-center gap-1 justify-self-center">
          <NavLink to="/" label={t("nav.home")} active={pathname === "/"} />
          <NavLink to="/about" label={t("nav.about")} active={pathname === "/about"} />
        </div>

        <div data-region="chrome-controls" className="flex items-center gap-2 justify-self-end">
          <LocaleToggle />
          <ThemeToggle />
          {/* Visual separator + breathing room between the toggle pair
              and the auth action so the avatar doesn't crash into the
              theme icon. */}
          <span aria-hidden className="ml-2 h-6 w-px bg-border" />
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
    <Link
      to="/login"
      className={`${AUTH_ACTION_SIZE_CLASSES} focus-visible-ring cursor-pointer rounded-lg bg-accent-purple text-sm font-semibold text-white transition-opacity hover:opacity-90`}
    >
      {ctaLabel}
    </Link>
  );
}
