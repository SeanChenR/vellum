/**
 * SessionsPage — list active sessions and revoke individual ones.
 *
 * - GET /api/account/sessions (TanStack Query)
 * - DELETE /api/account/sessions/:id to revoke
 * - If current session is revoked, calls logout() and navigates to /login
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";

interface SessionItem {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

interface SessionsResponse {
  data?: { sessions: SessionItem[] };
  error?: { errorKey: string };
}

async function fetchSessions(): Promise<SessionItem[]> {
  const resp = await fetch("/api/account/sessions");
  const body = (await resp.json()) as SessionsResponse;
  if (!resp.ok) throw new Error("fetch sessions failed");
  return body.data?.sessions ?? [];
}

async function revokeSession(sessionId: string): Promise<void> {
  const resp = await fetch(`/api/account/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!resp.ok) throw new Error("revoke failed");
}

export function SessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["account", "sessions"],
    queryFn: fetchSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: async (_data, sessionId) => {
      const revokedSession = sessions.find((s) => s.id === sessionId);
      if (revokedSession?.isCurrent) {
        await logout();
        void navigate({ to: "/login" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["account", "sessions"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="text-warm-sepia">Loading…</span>
      </div>
    );
  }

  return (
    <div>
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="font-serif text-2xl text-ink-navy mb-8">{t("account.sessions.title")}</h1>

        <ul className="space-y-4">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-4"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">
                    {session.userAgent ?? t("account.sessions.userAgent")}
                  </p>
                  {session.isCurrent && (
                    <span
                      data-testid="current-session-badge"
                      className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                    >
                      {t("account.sessions.current")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {session.ipAddress} · {new Date(session.createdAt).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                aria-label={t("account.sessions.revokeButton")}
                data-testid={session.isCurrent ? "revoke-current-session" : undefined}
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(session.id)}
                className="ml-4 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {t("account.sessions.revokeButton")}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
