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
    // TanStack Router's location.search is the parsed object, not the raw
    // query string — concatenating it would throw "Cannot convert object to
    // primitive value". The raw URL portion lives on globalThis.location.
    const redirect = location.pathname + globalThis.location.search;
    return <Navigate to="/login" search={{ redirect }} />;
  }

  return <>{children}</>;
}
