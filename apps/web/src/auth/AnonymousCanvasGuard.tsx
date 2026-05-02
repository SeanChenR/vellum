/**
 * AnonymousCanvasGuard — gates `/canvas/:id` so anonymous public-link
 * visitors can enter without bouncing through `/login`.
 *
 * Decision tree:
 *   - auth still loading → render nothing (avoid premature redirect)
 *   - has session         → render children unchanged
 *   - no session + ?share → render children (anonymous path)
 *   - no session + no ?share → redirect to /login?redirect=<original>
 *
 * Replaces the existing `RouteGuard` ONLY for the canvas route — other
 * routes still want hard redirect on missing auth.
 *
 * Spec: sharing — "Anonymous visitors enter via public link without login redirect"
 */

import { useEffect, type ReactNode } from "react";
import { useAuth } from "./useAuth";

export interface AnonymousCanvasGuardProps {
  children: ReactNode;
  /** Override for tests; production passes window.location.assign. */
  redirect?: (href: string) => void;
}

export function AnonymousCanvasGuard({ children, redirect }: AnonymousCanvasGuardProps) {
  const { user, isLoading } = useAuth();
  const hasShareToken =
    typeof window !== "undefined" && new URL(window.location.href).searchParams.has("share");
  const shouldRedirect = !isLoading && !user && !hasShareToken;
  const target =
    typeof window !== "undefined"
      ? `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
      : "/login";

  useEffect(() => {
    if (!shouldRedirect) return;
    (redirect ?? ((href) => window.location.assign(href)))(target);
  }, [shouldRedirect, target, redirect]);

  if (isLoading) return null;
  if (shouldRedirect) return null;
  return <>{children}</>;
}
