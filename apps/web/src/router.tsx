import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { VELLUM_VERSION } from "@vellum/shared";
import { RouteGuard } from "./auth/RouteGuard";
import { LoginPage } from "./auth/LoginPage";
import { OAuthCallbackPage } from "./auth/OAuthCallbackPage";
import { MagicLinkVerifyPage } from "./auth/MagicLinkVerifyPage";
import { ProfilePage } from "./account/ProfilePage";
import { SessionsPage } from "./account/SessionsPage";

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
    redirect:
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
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
      <DashboardPlaceholder />
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

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="font-serif text-4xl text-ink-navy">
          {t("app.name", "Vellum")}
        </h1>
        <p className="mt-2 text-warm-sepia">
          {t("app.tagline", "Scaffolding stub")} · v{VELLUM_VERSION}
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-ink-navy px-6 py-3 text-sm font-semibold text-white"
        >
          Get started
        </a>
      </div>
    </main>
  );
}

function DashboardPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-ink-navy">Dashboard — coming in M2</p>
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
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
