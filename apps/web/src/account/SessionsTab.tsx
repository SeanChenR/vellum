/**
 * SessionsTab — `/account?tab=sessions` panel content.
 *
 * Extracted from `SessionsPage.tsx`. AccountPage provides the outer
 * page container; this component owns the sessions list + revoke
 * confirm dialog.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

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

export function SessionsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["account", "sessions"],
    queryFn: fetchSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ["account", "sessions"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="text-text-muted">{t("common.loading")}</span>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const confirmTarget = sessions.find((s) => s.id === confirmId) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <ul className="space-y-3">
          {sorted.map((session) => (
            <li key={session.id}>
              <Card variant="outlined" className="!p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {session.userAgent ?? t("account.sessions.userAgent")}
                      </p>
                      {session.isCurrent && (
                        <Badge tone="cyan" data-testid="current-session-badge">
                          {t("account.sessions.thisDeviceBadge")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {session.ipAddress} · {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {!session.isCurrent && (
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={t("account.sessions.revokeButton")}
                      onClick={() => setConfirmId(session.id)}
                    >
                      {t("account.sessions.revokeButton")}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Card>

      {confirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <Card variant="elevated" className="w-full max-w-md">
            <h2
              id="revoke-confirm-title"
              className="mb-2 font-serif text-lg font-semibold text-text-primary"
            >
              {t("account.sessions.revokeConfirmTitle")}
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              {t("account.sessions.revokeConfirmBody")}
            </p>
            <p className="mb-4 text-xs text-text-muted">
              {confirmTarget.userAgent ?? t("account.sessions.userAgent")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmId(null)}
                disabled={revokeMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => revokeMutation.mutate(confirmTarget.id)}
                disabled={revokeMutation.isPending}
                className="!bg-accent-red"
              >
                {t("account.sessions.revokeButton")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
