/**
 * DashboardPage — main canvas dashboard with the Aura two-column layout.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 9
 * Spec ref:   openspec/specs/public-pages/spec.md
 *   "DashboardPage uses a two-column layout with greeting strip, sidebar,
 *    and canvas grid"
 *
 * Structure:
 *   - <DashboardGreeting> top strip with date, welcome line, search, "New".
 *   - Two-column grid: <DashboardSidebar> | <CanvasGrid>.
 *   - All canvas / folder dialogs orchestrated here.
 *
 * "Shared with me" still uses a virtual folder selector so users on a
 * specific folder view aren't visually distracted by canvases they don't
 * own (Bug 3 fix, preserved from previous implementation).
 *
 * NO subscription / upgrade callout is rendered — vellum has no
 * subscription tier; the spec explicitly requires this absence.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useAuth } from "../auth/useAuth";
import { useCanvasList } from "./useCanvasList";
import type { Canvas } from "./useCanvasList";
import { useFolderList } from "./useFolderList";
import type { Folder } from "./useFolderList";
import { CanvasCreateDialog } from "../components/CanvasCreateDialog";
import { CanvasRenameDialog } from "../components/CanvasRenameDialog";
import { CanvasDeleteDialog } from "../components/CanvasDeleteDialog";
import { CanvasMoveDialog } from "../components/CanvasMoveDialog";
import { FolderCreateDialog } from "../components/FolderCreateDialog";
import { FolderRenameDialog } from "../components/FolderRenameDialog";
import { FolderDeleteDialog } from "../components/FolderDeleteDialog";
import { CanvasGrid } from "./CanvasGrid";
import { DashboardGreeting } from "./DashboardGreeting";
import { DashboardSidebar } from "./DashboardSidebar";
import { SortToggle } from "./SortToggle";
import { useSortOrder } from "./useSortOrder";

type DialogState =
  | { kind: "none" }
  | { kind: "canvas-create" }
  | { kind: "canvas-rename"; canvas: Canvas }
  | { kind: "canvas-delete"; canvas: Canvas }
  | { kind: "canvas-move"; canvas: Canvas }
  | { kind: "folder-create" }
  | { kind: "folder-rename"; folder: Folder }
  | { kind: "folder-delete"; folder: Folder; errorKey: string | null };

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const { order: sortOrder, setOrder: setSortOrder } = useSortOrder();

  const isSharedView = activeFolderId === "shared";

  const folderFilter =
    activeFolderId === "unfiled" ? null : activeFolderId === null ? undefined : activeFolderId;

  const ownedList = useCanvasList("owned", isSharedView ? undefined : folderFilter);
  const sharedList = useCanvasList("shared");
  const { folders, createFolder, renameFolder, deleteFolder } = useFolderList();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const canvasId = String(active.id);
    const targetId = String(over.id);
    if (targetId === "all") return;
    if (targetId === "shared") return;
    const targetFolderId = targetId === "unfiled" ? null : targetId;
    ownedList.moveCanvas.mutate({ id: canvasId, folderId: targetFolderId });
  }

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

  const activeCanvases = isSharedView ? sharedList.canvases : ownedList.canvases;
  const userName = user?.name ?? "";

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        data-testid="dashboard-root"
        className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 md:px-8"
      >
        <DashboardGreeting
          userName={userName}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateClick={() => setDialog({ kind: "canvas-create" })}
        />

        <div
          data-testid="dashboard-two-col"
          className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]"
        >
          <DashboardSidebar
            folders={folders}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolderId}
            onRenameFolder={(folder) => setDialog({ kind: "folder-rename", folder })}
            onDeleteFolder={(folder) =>
              setDialog({ kind: "folder-delete", folder, errorKey: null })
            }
            onCreateFolder={() => setDialog({ kind: "folder-create" })}
          />

          <main className="min-w-0">
            <section aria-labelledby="section-active" data-testid="dashboard-canvas-section">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="section-active" className="font-serif text-xl text-text-primary">
                  {isSharedView ? t("dashboard.sharedWithMe") : t("dashboard.myCanvases")}
                </h2>
                <SortToggle value={sortOrder} onChange={setSortOrder} />
              </div>

              {(isSharedView ? sharedList.isLoading : ownedList.isLoading) ? (
                <p className="text-sm text-text-muted">{t("common.loading")}</p>
              ) : (
                <CanvasGrid
                  canvases={activeCanvases}
                  searchQuery={searchQuery}
                  sortOrder={sortOrder}
                  emptyMessageKey={
                    isSharedView ? "dashboard.empty.shared" : "dashboard.empty.owned"
                  }
                  onRename={(c) => setDialog({ kind: "canvas-rename", canvas: c })}
                  onDelete={(c) => setDialog({ kind: "canvas-delete", canvas: c })}
                  onMove={(c) => {
                    if (isSharedView) return;
                    setDialog({ kind: "canvas-move", canvas: c });
                  }}
                />
              )}
            </section>
          </main>
        </div>
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
