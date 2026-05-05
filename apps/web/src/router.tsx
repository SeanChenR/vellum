import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import React from "react";
import { RouteGuard } from "./auth/RouteGuard";
import { AnonymousCanvasGuard } from "./auth/AnonymousCanvasGuard";
import { useAuth } from "./auth/useAuth";
import { LoginPage } from "./auth/LoginPage";
import { OAuthCallbackPage } from "./auth/OAuthCallbackPage";
import { MagicLinkVerifyPage } from "./auth/MagicLinkVerifyPage";
import { InviteErrorPage } from "./auth/InviteErrorPage";
import { PostLoginPage } from "./auth/PostLoginPage";
import { ProfilePage } from "./account/ProfilePage";
import { SessionsPage } from "./account/SessionsPage";
import { DashboardPage } from "./dashboard/DashboardPage";
import { CanvasPage } from "./canvas/CanvasPage";
import { PublicLayout } from "./landing/PublicLayout";
import { HomePage as LandingHomePage } from "./landing/HomePage";
import { AboutPage } from "./landing/AboutPage";

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

/**
 * Public route wrappers — Homepage and About page both render their
 * content inside the shared <PublicLayout> shell. Authenticated visitors
 * are redirected to /dashboard; anonymous visitors see the public surface.
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

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-off-white">
        <span className="text-warm-sepia text-sm">Loading…</span>
      </main>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
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
