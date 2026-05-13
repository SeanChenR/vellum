/**
 * legacy-redirects.tsx — redirect components for the pre-tab account paths.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 10
 * Spec ref:   openspec/specs/account/spec.md
 *   "Legacy /account/profile redirects to tab" — preserves old bookmarks
 *   by redirecting `/account/<segment>` → `/account?tab=<segment>` with
 *   `replace: true` so the legacy URL does not stay in history.
 */

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

function useRedirectToTab(tab: "profile" | "sessions" | "api-keys") {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/account", search: { tab }, replace: true });
  }, [navigate, tab]);
}

export function ProfileRouteRedirect() {
  useRedirectToTab("profile");
  return null;
}

export function SessionsRouteRedirect() {
  useRedirectToTab("sessions");
  return null;
}

export function ApiKeysRouteRedirect() {
  useRedirectToTab("api-keys");
  return null;
}
