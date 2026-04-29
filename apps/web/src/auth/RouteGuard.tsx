/**
 * RouteGuard — HOC that protects routes requiring authentication.
 *
 * - Checks useAuth(); while loading shows a spinner.
 * - If not authenticated, redirects to /login?redirect=<currentPath>.
 * - If authenticated, renders children.
 */

import { Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "./useAuth";

interface RouteGuardProps {
  children: ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-warm-sepia">Loading…</span>
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} />;
  }

  return <>{children}</>;
}
