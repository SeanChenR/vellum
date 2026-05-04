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
import { useDroppable } from "@dnd-kit/core";
import type { Folder } from "../dashboard/useFolderList";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FolderTreeProps {
  folders: Folder[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
}

// ---------------------------------------------------------------------------
// DroppableRow — a single folder row that accepts canvas card drops.
// `actions` (optional) renders hover-revealed buttons next to the label
// (e.g. rename / delete). Synthetic rows pass undefined.
// ---------------------------------------------------------------------------

interface DroppableRowProps {
  droppableId: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
}

function DroppableRow({ droppableId, label, isActive, onClick, actions }: DroppableRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div ref={setNodeRef} className="group relative">
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
        <span className="truncate">{label}</span>
      </button>
      {actions && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {actions}
        </div>
      )}
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
  onRenameFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const { t } = useTranslation();

  return (
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

      {/* Synthetic: Shared with me — virtual folder, not a drop target for
          owned canvases (the dnd handler short-circuits on droppableId
          "shared"). Visually grouped with the other sentinels above. */}
      <DroppableRow
        droppableId="shared"
        label={t("dashboard.sharedWithMe")}
        isActive={activeFolderId === "shared"}
        onClick={() => onSelectFolder("shared")}
      />

      {/* Owned folders — flat list, no nesting */}
      {folders.map((folder) => (
        <DroppableRow
          key={folder.id}
          droppableId={folder.id}
          label={folder.name}
          isActive={activeFolderId === folder.id}
          onClick={() => onSelectFolder(folder.id)}
          actions={
            (onRenameFolder || onDeleteFolder) && (
              <div className="flex items-center gap-0.5 rounded-md bg-white/95 px-1 shadow-sm">
                {onRenameFolder && (
                  <button
                    type="button"
                    aria-label={t("folder.rename")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameFolder(folder);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-ink-navy"
                  >
                    <PencilIcon />
                  </button>
                )}
                {onDeleteFolder && (
                  <button
                    type="button"
                    aria-label={t("folder.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            )
          }
        />
      ))}
    </nav>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M11.7 1.2l3.1 3.1c.4.4.4 1 0 1.4L5.6 14.9l-4.4.5.5-4.4L10.3 1.2c.4-.4 1-.4 1.4 0z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M5.5 1h5l.5 1H14v1H2V2h3l.5-1zM3 4h10l-1 11H4L3 4z" />
    </svg>
  );
}
