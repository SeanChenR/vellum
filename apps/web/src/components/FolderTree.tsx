/**
 * FolderTree — dashboard sidebar folder navigation.
 *
 * Displays a flat list (1-level only):
 *   1. "All canvases" — synthetic row, clears folder filter
 *   2. "Unfiled"      — synthetic row, shows canvases with folderId null
 *   3. Owned folders  — one row per folder, sorted by name asc (server-sorted)
 *
 * Each folder row is a drop target for canvas cards (dnd-kit).
 * Clicking a row calls onSelectFolder with the folder id (or null).
 *
 * Spec: "Folder tree component renders flat list with drag targets"
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  useDroppable,
  useSensors,
  useSensor,
  PointerSensor,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Folder } from "../dashboard/useFolderList";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FolderTreeProps {
  folders: Folder[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  /** Called when a canvas is dropped onto a folder row */
  onMoveCanvas: (canvasId: string, targetFolderId: string | null) => void;
}

// ---------------------------------------------------------------------------
// DroppableRow — a single folder row that accepts canvas card drops
// ---------------------------------------------------------------------------

interface DroppableRowProps {
  droppableId: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function DroppableRow({
  droppableId,
  label,
  isActive,
  onClick,
}: DroppableRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div ref={setNodeRef}>
      <button
        type="button"
        onClick={onClick}
        className={[
          "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
          isActive
            ? "bg-ink-navy/10 font-semibold text-ink-navy"
            : "text-gray-600 hover:bg-gray-100",
          isOver ? "ring-2 ring-ink-navy ring-inset" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderTree
// ---------------------------------------------------------------------------

export function FolderTree({
  folders,
  activeFolderId,
  onSelectFolder,
  onMoveCanvas,
}: FolderTreeProps) {
  const { t } = useTranslation();

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const canvasId = String(active.id);
    const targetId = String(over.id);

    if (targetId === "all") {
      // Dropping to "All canvases" doesn't change folderId
      return;
    }
    if (targetId === "unfiled") {
      onMoveCanvas(canvasId, null);
      return;
    }
    // Folder drop target id is the folder id
    onMoveCanvas(canvasId, targetId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <nav aria-label="Folder navigation" className="space-y-0.5">
        {/* Synthetic: All canvases */}
        <DroppableRow
          droppableId="all"
          label={t("folder.allCanvases")}
          isActive={activeFolderId === null}
          onClick={() => onSelectFolder(null)}
        />

        {/* Synthetic: Unfiled */}
        <DroppableRow
          droppableId="unfiled"
          label={t("folder.unfiled")}
          isActive={activeFolderId === "unfiled"}
          onClick={() => onSelectFolder("unfiled")}
        />

        {/* Owned folders — flat list, no nesting */}
        {folders.map((folder) => (
          <DroppableRow
            key={folder.id}
            droppableId={folder.id}
            label={folder.name}
            isActive={activeFolderId === folder.id}
            onClick={() => onSelectFolder(folder.id)}
          />
        ))}
      </nav>
    </DndContext>
  );
}
