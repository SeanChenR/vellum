/**
 * useAuth — TanStack Query hook for the authenticated user.
 *
 * - Fetches GET /api/account/profile; cache key ['auth', 'session'].
 * - Calls i18n.changeLanguage(user.locale) on first successful load.
 * - Returns { user, isLoading, isAuthenticated }.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import i18n from "../i18n";
import type { SupportedLanguage } from "../i18n";

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

export function useAuth(): UseAuthReturn {
  const queryClient = useQueryClient();

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
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    queryClient.setQueryData(["auth", "session"], null);
    await queryClient.invalidateQueries({ queryKey: ["auth"] });
  }, [queryClient]);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    logout,
  };
}
