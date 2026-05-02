import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { VELLUM_VERSION } from "@vellum/shared";
import { RouteGuard } from "./auth/RouteGuard";
import { AnonymousCanvasGuard } from "./auth/AnonymousCanvasGuard";
import { useAuth } from "./auth/useAuth";
import { LoginPage } from "./auth/LoginPage";
import { OAuthCallbackPage } from "./auth/OAuthCallbackPage";
import { MagicLinkVerifyPage } from "./auth/MagicLinkVerifyPage";
import { ProfilePage } from "./account/ProfilePage";
import { SessionsPage } from "./account/SessionsPage";
import { DashboardPage } from "./dashboard/DashboardPage";
import { CanvasPage } from "./canvas/CanvasPage";
import vellumLogo from "./assets/vellum-logo.png";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen">
      <Outlet />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  component: LoginPage,
});

const oauthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/callback",
  component: OAuthCallbackPage,
});

const magicLinkVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/verify",
  component: MagicLinkVerifyPage,
});

// ---------------------------------------------------------------------------
// Protected routes (wrapped in RouteGuard)
// ---------------------------------------------------------------------------

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: () => (
    <RouteGuard>
      <DashboardPage />
    </RouteGuard>
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/profile",
  component: () => (
    <RouteGuard>
      <ProfilePage />
    </RouteGuard>
  ),
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/sessions",
  component: () => (
    <RouteGuard>
      <SessionsPage />
    </RouteGuard>
  ),
});

// Canvas route uses the anonymous-aware guard so visitors with a
// `?share=<token>` query can enter without bouncing through /login.
const canvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/canvas/$id",
  component: () => (
    <AnonymousCanvasGuard>
      <CanvasPage />
    </AnonymousCanvasGuard>
  ),
});

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();

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

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="flex flex-col items-center text-center">
        <img
          src={vellumLogo}
          alt={t("app.name")}
          className="h-16 w-16 select-none"
          draggable={false}
        />
        <h1 className="mt-4 font-serif text-4xl text-ink-navy">{t("app.name", "Vellum")}</h1>
        <p className="mt-2 text-warm-sepia">
          {t("app.tagline", "Scaffolding stub")} · v{VELLUM_VERSION}
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-ink-navy px-6 py-3 text-sm font-semibold text-white hover:bg-ink-navy/90"
        >
          {t("app.getStarted", "Get started")}
        </a>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  oauthCallbackRoute,
  magicLinkVerifyRoute,
  dashboardRoute,
  profileRoute,
  sessionsRoute,
  canvasRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
