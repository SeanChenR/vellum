/**
 * useAuth — TanStack Query hook for the authenticated user.
 *
 * - Fetches GET /api/account/profile; cache key ['auth', 'session'].
 * - Calls i18n.changeLanguage(user.locale) on first successful load.
 * - Returns { user, isLoading, isAuthenticated, logout }.
 *
 * Logout navigates to `/` (landing) — never `/login`. Sign-out is a full
 * session reset, so the hook does a hard navigation via
 * `window.location.assign` to flush all in-memory state (i18n, Zustand,
 * query cache). Tests inject a `navigate` override.
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import i18n from "../i18n";
import type { SupportedLanguage } from "../i18n";
import { performLogout } from "./perform-logout";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  locale: SupportedLanguage;
  createdAt: string;
}

interface ProfileResponse {
  data?: AuthUser;
  error?: { errorKey: string };
}

async function fetchProfile(): Promise<AuthUser | null> {
  const resp = await fetch("/api/account/profile");
  if (resp.status === 401) return null;
  if (!resp.ok) return null;
  const body = (await resp.json()) as ProfileResponse;
  return body.data ?? null;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export function useAuth(navigate?: (href: string) => void): UseAuthReturn {
  const { data: user = null, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["auth", "session"],
    queryFn: fetchProfile,
    staleTime: 60_000,
    retry: false,
  });

  // Sync i18n locale from user preference
  useEffect(() => {
    if (user?.locale && i18n.language !== user.locale) {
      void i18n.changeLanguage(user.locale);
    }
  }, [user?.locale]);

  const logout = useCallback(async () => {
    await performLogout({
      signOut: async () => {
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
      },
      navigate: navigate ?? ((href: string) => window.location.assign(href)),
    });
  }, [navigate]);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    logout,
  };
}
