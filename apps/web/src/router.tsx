import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { RouteGuard } from "./auth/RouteGuard";
import { AnonymousCanvasGuard } from "./auth/AnonymousCanvasGuard";
import { useAuth } from "./auth/useAuth";
import { LoginPage } from "./auth/LoginPage";
import { OAuthCallbackPage } from "./auth/OAuthCallbackPage";
import { MagicLinkVerifyPage } from "./auth/MagicLinkVerifyPage";
import { InviteErrorPage } from "./auth/InviteErrorPage";
import { PostLoginPage } from "./auth/PostLoginPage";
import { AccountPage } from "./account/AccountPage";
import {
  ApiKeysRouteRedirect,
  ProfileRouteRedirect,
  SessionsRouteRedirect,
} from "./account/legacy-redirects";
import { DashboardPage } from "./dashboard/DashboardPage";
import { CanvasPage } from "./canvas/CanvasPage";
import { PublicLayout } from "./landing/PublicLayout";
import { AppLayout } from "./landing/AppLayout";
import { HomePage as LandingHomePage } from "./landing/HomePage";
import { AboutPage } from "./landing/AboutPage";
import { ThemeProvider } from "./theme/theme-provider";

const rootRoute = createRootRoute({
  component: () => (
    <ThemeProvider>
      <div className="min-h-screen">
        <Outlet />
      </div>
    </ThemeProvider>
  ),
});

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: AboutRoute,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  component: LoginRoute,
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

const inviteErrorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invite-error",
  component: InviteErrorPage,
});

const postLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/post-login",
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  component: PostLoginPage,
});

// ---------------------------------------------------------------------------
// Protected routes (wrapped in RouteGuard)
// ---------------------------------------------------------------------------

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: () => (
    <RouteGuard>
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    </RouteGuard>
  ),
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search["tab"] === "string" ? search["tab"] : undefined,
  }),
  component: () => (
    <RouteGuard>
      <AppLayout>
        <AccountPage />
      </AppLayout>
    </RouteGuard>
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/profile",
  component: ProfileRouteRedirect,
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/sessions",
  component: SessionsRouteRedirect,
});

const apiKeysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/api-keys",
  component: ApiKeysRouteRedirect,
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

/**
 * Public route wrappers — Homepage, About, and Login all render inside
 * the shared <PublicLayout> shell. Authenticated visitors see the same
 * public surface as anonymous visitors (the Navbar's auth-aware right
 * side reflects their signed-in state); they are no longer redirected
 * away from / or /about.
 */

function HomeRoute() {
  return (
    <PublicRoute>
      <LandingHomePage />
    </PublicRoute>
  );
}

function AboutRoute() {
  return (
    <PublicRoute>
      <AboutPage />
    </PublicRoute>
  );
}

function LoginRoute() {
  return (
    <PublicRoute>
      <LoginPage />
    </PublicRoute>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-off-white">
        <span className="text-warm-sepia text-sm">{t("common.loading")}</span>
      </main>
    );
  }
  return <PublicLayout>{children}</PublicLayout>;
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  loginRoute,
  oauthCallbackRoute,
  magicLinkVerifyRoute,
  inviteErrorRoute,
  postLoginRoute,
  dashboardRoute,
  accountRoute,
  profileRoute,
  sessionsRoute,
  apiKeysRoute,
  canvasRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
