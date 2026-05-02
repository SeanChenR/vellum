/**
 * CanvasPage.tsx — Route component for /canvas/:id.
 *
 * Responsibilities:
 *   - Extract canvasId from route params
 *   - Fetch canvas metadata via useCanvasQuery
 *   - Show loading/error states
 *   - Render <Editor> with canvas data + mutation handlers
 *   - Wire onShareClick → placeholder toast (canvas.chrome.topbar.sharePlaceholderToast)
 *
 * Design: "Share button 是 placeholder：onShareClick callback prop"
 * Spec: "Share button placeholder triggers a not-yet-available toast"
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useAuth } from "../auth/useAuth";
import { useCanvasQuery } from "./useCanvasQuery";
import { useCanvasList } from "../dashboard/useCanvasList";
import { useFolderList } from "../dashboard/useFolderList";
import { Editor } from "./Editor";

// ---------------------------------------------------------------------------
// CanvasPage
// ---------------------------------------------------------------------------

export function CanvasPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/canvas/$id" });
  const { user, logout } = useAuth();
  const query = useCanvasQuery(id);

  // Mutations from the canvas list hook (scope=owned — canvas is assumed owned)
  const { renameCanvas, deleteCanvas, createCanvas } = useCanvasList("owned");
  const { folders } = useFolderList();

  // Public-link share token (anonymous visitors arrive at
  // `/canvas/:id?share=<token>`); falls through to the cookie path when absent.
  const shareToken =
    typeof window !== "undefined"
      ? (new URL(window.location.href).searchParams.get("share") ?? undefined)
      : undefined;

  // ---------------------------------------------------------------------------
  // States
  // ---------------------------------------------------------------------------

  if (query.status === "loading") {
    return (
      <div
        role="status"
        aria-label={t("app.name")}
        className="flex h-screen items-center justify-center"
      >
        <span className="text-sm text-warm-sepia">{t("canvas.chrome.loading")}</span>
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-600">{t("errors.canvas.notFound")}</p>
        <a
          href="/dashboard"
          className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink-navy/90"
        >
          {t("dashboard.myCanvases")}
        </a>
      </div>
    );
  }

  const canvas = query.data;

  const folderRecord = canvas.folderId ? folders.find((f) => f.id === canvas.folderId) : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Editor
        canvasId={canvas.id}
        title={canvas.title}
        folder={folderRecord ? { id: folderRecord.id, name: folderRecord.name } : null}
        ownerId={canvas.ownerId}
        onRenameSubmit={(newTitle) => {
          renameCanvas.mutate({ id: canvas.id, title: newTitle });
        }}
        onDuplicate={() => {
          createCanvas.mutate({
            title: `${canvas.title} ${t("canvas.chrome.duplicateSuffix")}`,
            folderId: canvas.folderId,
          });
        }}
        onDelete={() => {
          deleteCanvas.mutate(canvas.id, {
            onSuccess: () => {
              window.location.href = "/dashboard";
            },
          });
        }}
        currentUser={user ?? null}
        onSignOut={logout}
        shareToken={shareToken}
      />
    </div>
  );
}
