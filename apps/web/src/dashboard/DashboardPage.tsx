/**
 * DashboardPage — main canvas dashboard.
 *
 * Layout:
 *   Left sidebar: FolderTree with sentinels [All / Unfiled / Shared with me]
 *     followed by the user's own folders.
 *   Main area: renders one section depending on `activeFolderId`:
 *     - "shared" → "Shared with me" canvases (not filterable by folder)
 *     - any other (null / "unfiled" / <folder uuid>) → "My Canvases"
 *
 * Note: "Shared with me" is a virtual folder rather than a permanent
 * second section, so users on a specific folder view aren't visually
 * distracted by canvases they don't own (Bug 3 fix).
 *
 * Dialog orchestration: all 6 dialogs (create/rename/delete for canvas and folder)
 * are managed here at the page level.
 *
 * Spec: "Dashboard canvas list view"
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useCanvasList } from "./useCanvasList";
import type { Canvas } from "./useCanvasList";
import { useFolderList } from "./useFolderList";
import type { Folder } from "./useFolderList";
import { FolderTree } from "../components/FolderTree";
import { CanvasCard } from "../components/CanvasCard";
import { CanvasCreateDialog } from "../components/CanvasCreateDialog";
import { CanvasRenameDialog } from "../components/CanvasRenameDialog";
import { CanvasDeleteDialog } from "../components/CanvasDeleteDialog";
import { CanvasMoveDialog } from "../components/CanvasMoveDialog";
import { FolderCreateDialog } from "../components/FolderCreateDialog";
import { FolderRenameDialog } from "../components/FolderRenameDialog";
import { FolderDeleteDialog } from "../components/FolderDeleteDialog";
import { FadeIn, StaggerContainer } from "../motion/primitives";

// ---------------------------------------------------------------------------
// Dialog state types
// ---------------------------------------------------------------------------

type DialogState =
  | { kind: "none" }
  | { kind: "canvas-create" }
  | { kind: "canvas-rename"; canvas: Canvas }
  | { kind: "canvas-delete"; canvas: Canvas }
  | { kind: "canvas-move"; canvas: Canvas }
  | { kind: "folder-create" }
  | { kind: "folder-rename"; folder: Folder }
  | { kind: "folder-delete"; folder: Folder; errorKey: string | null };

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { t } = useTranslation();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  const isSharedView = activeFolderId === "shared";

  // Owned canvases (filtered by folder when activeFolderId is a folder selector).
  // Skip when sharedView is active — caller binds to sharedList instead.
  const folderFilter =
    activeFolderId === "unfiled" ? null : activeFolderId === null ? undefined : activeFolderId;

  const ownedList = useCanvasList("owned", isSharedView ? undefined : folderFilter);
  const sharedList = useCanvasList("shared");
  const { folders, createFolder, renameFolder, deleteFolder } = useFolderList();

  // ---------------------------------------------------------------------------
  // Canvas handlers
  // ---------------------------------------------------------------------------

  // PointerSensor with a small activation distance lets the canvas card
  // remain clickable for navigation while still allowing drags to start
  // once the pointer travels >5px.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const canvasId = String(active.id);
    const targetId = String(over.id);
    if (targetId === "all") return; // dropping on "All canvases" is a no-op
    if (targetId === "shared") return; // owned canvases can't be dropped into "Shared with me"
    const targetFolderId = targetId === "unfiled" ? null : targetId;
    ownedList.moveCanvas.mutate({ id: canvasId, folderId: targetFolderId });
  }

  // ---------------------------------------------------------------------------
  // Folder delete (needs notEmpty error handling)
  // ---------------------------------------------------------------------------

  function handleFolderDeleteConfirm() {
    if (dialog.kind !== "folder-delete") return;
    const folderId = dialog.folder.id;
    deleteFolder.mutate(folderId, {
      onError: (err: unknown) => {
        const errorKey =
          err instanceof Error &&
          "errorKey" in err &&
          typeof (err as { errorKey: unknown }).errorKey === "string"
            ? (err as { errorKey: string }).errorKey
            : null;
        setDialog({ kind: "folder-delete", folder: dialog.folder, errorKey });
      },
      onSuccess: () => {
        setDialog({ kind: "none" });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
        {/* Folder tabs — horizontal pill strip, aligned with Navbar width */}
        <FolderTree
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={setActiveFolderId}
          onRenameFolder={(folder) => setDialog({ kind: "folder-rename", folder })}
          onDeleteFolder={(folder) => setDialog({ kind: "folder-delete", folder, errorKey: null })}
          onCreateFolder={() => setDialog({ kind: "folder-create" })}
        />

        {/* Main content — single section based on activeFolderId */}
        <main className="flex-1">
          {isSharedView ? (
            <section aria-labelledby="section-shared">
              <h2 id="section-shared" className="mb-4 text-xl font-semibold text-ink-navy">
                {t("dashboard.sharedWithMe")}
              </h2>

              {sharedList.isLoading ? (
                <p className="text-sm text-gray-400">{t("common.loading")}</p>
              ) : sharedList.canvases.length === 0 ? (
                <p className="text-sm text-gray-500">{t("dashboard.empty.shared")}</p>
              ) : (
                <StaggerContainer
                  staggerMs={80}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {sharedList.canvases.map((canvas) => (
                    <FadeIn key={canvas.id} duration={400}>
                      <CanvasCard
                        canvas={canvas}
                        onRename={(c) => setDialog({ kind: "canvas-rename", canvas: c })}
                        onDelete={(c) => setDialog({ kind: "canvas-delete", canvas: c })}
                        onMove={() => {}}
                      />
                    </FadeIn>
                  ))}
                </StaggerContainer>
              )}
            </section>
          ) : (
            <section aria-labelledby="section-owned">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="section-owned" className="text-xl font-semibold text-ink-navy">
                  {t("dashboard.myCanvases")}
                </h2>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "canvas-create" })}
                  className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink-navy/90"
                >
                  {t("dashboard.createCanvas")}
                </button>
              </div>

              {ownedList.isLoading ? (
                <p className="text-sm text-gray-400">{t("common.loading")}</p>
              ) : ownedList.canvases.length === 0 ? (
                <p className="text-sm text-gray-500">{t("dashboard.empty.owned")}</p>
              ) : (
                <StaggerContainer
                  staggerMs={80}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {ownedList.canvases.map((canvas) => (
                    <FadeIn key={canvas.id} duration={400}>
                      <CanvasCard
                        canvas={canvas}
                        onRename={(c) => setDialog({ kind: "canvas-rename", canvas: c })}
                        onDelete={(c) => setDialog({ kind: "canvas-delete", canvas: c })}
                        onMove={(c) => setDialog({ kind: "canvas-move", canvas: c })}
                      />
                    </FadeIn>
                  ))}
                </StaggerContainer>
              )}
            </section>
          )}
        </main>
      </div>

      {/* ── Dialogs ── */}

      <CanvasCreateDialog
        open={dialog.kind === "canvas-create"}
        onConfirm={(title) => {
          ownedList.createCanvas.mutate(
            { title, folderId: activeFolderId === "unfiled" ? null : activeFolderId },
            { onSuccess: () => setDialog({ kind: "none" }) },
          );
        }}
        onClose={() => setDialog({ kind: "none" })}
        isPending={ownedList.createCanvas.isPending}
      />

      <CanvasRenameDialog
        open={dialog.kind === "canvas-rename"}
        currentTitle={dialog.kind === "canvas-rename" ? dialog.canvas.title : ""}
        onConfirm={(newTitle) => {
          if (dialog.kind !== "canvas-rename") return;
          ownedList.renameCanvas.mutate(
            { id: dialog.canvas.id, title: newTitle },
            { onSuccess: () => setDialog({ kind: "none" }) },
          );
        }}
        onClose={() => setDialog({ kind: "none" })}
        isPending={dialog.kind === "canvas-rename" && ownedList.renameCanvas.isPending}
      />

      <CanvasDeleteDialog
        open={dialog.kind === "canvas-delete"}
        canvasTitle={dialog.kind === "canvas-delete" ? dialog.canvas.title : ""}
        onConfirm={() => {
          if (dialog.kind !== "canvas-delete") return;
          ownedList.deleteCanvas.mutate(dialog.canvas.id, {
            onSuccess: () => setDialog({ kind: "none" }),
          });
        }}
        onClose={() => setDialog({ kind: "none" })}
        isPending={dialog.kind === "canvas-delete" && ownedList.deleteCanvas.isPending}
      />

      <FolderCreateDialog
        open={dialog.kind === "folder-create"}
        onConfirm={(name) => {
          createFolder.mutate(name, {
            onSuccess: () => setDialog({ kind: "none" }),
          });
        }}
        onClose={() => setDialog({ kind: "none" })}
        isPending={createFolder.isPending}
      />

      <FolderRenameDialog
        open={dialog.kind === "folder-rename"}
        currentName={dialog.kind === "folder-rename" ? dialog.folder.name : ""}
        onConfirm={(newName) => {
          if (dialog.kind !== "folder-rename") return;
          renameFolder.mutate(
            { id: dialog.folder.id, name: newName },
            { onSuccess: () => setDialog({ kind: "none" }) },
          );
        }}
        onClose={() => setDialog({ kind: "none" })}
        isPending={dialog.kind === "folder-rename" && renameFolder.isPending}
      />

      <FolderDeleteDialog
        open={dialog.kind === "folder-delete"}
        folderName={dialog.kind === "folder-delete" ? dialog.folder.name : ""}
        onConfirm={handleFolderDeleteConfirm}
        onClose={() => setDialog({ kind: "none" })}
        isPending={dialog.kind === "folder-delete" && deleteFolder.isPending}
        errorKey={dialog.kind === "folder-delete" ? dialog.errorKey : null}
      />

      <CanvasMoveDialog
        open={dialog.kind === "canvas-move"}
        currentFolderId={dialog.kind === "canvas-move" ? dialog.canvas.folderId : null}
        folders={folders}
        onConfirm={(targetFolderId) => {
          if (dialog.kind !== "canvas-move") return;
          ownedList.moveCanvas.mutate(
            { id: dialog.canvas.id, folderId: targetFolderId },
            { onSuccess: () => setDialog({ kind: "none" }) },
          );
        }}
        onClose={() => setDialog({ kind: "none" })}
        isPending={dialog.kind === "canvas-move" && ownedList.moveCanvas.isPending}
      />
    </DndContext>
  );
}
