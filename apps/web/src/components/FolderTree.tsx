/**
 * FolderTree — dashboard folder navigation.
 *
 * Displays a horizontal tab strip with three sentinels followed by the
 * user's folders:
 *   1. "All canvases" — clears folder filter
 *   2. "Unfiled"      — shows canvases with folderId null
 *   3. "Shared with me" — virtual folder for canvases shared by others
 *   4. User folders   — flat list, no nesting
 *
 * Each tab is a drop target for canvas cards (dnd-kit). User-folder
 * tabs reveal hover-only edit / delete affordances. An optional
 * `onCreateFolder` callback adds a `+` action at the end of the strip.
 *
 * Spec: "Folder navigation component renders flat list with drag targets"
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
  onCreateFolder?: () => void;
  /**
   * Layout mode.
   * - `"horizontal"` (default): pill strip used by the legacy
   *   DashboardPage when no sidebar exists.
   * - `"vertical"`: full-width row stack used inside DashboardSidebar
   *   (design Decision 9). Active row uses bg-accent-purple/10 +
   *   text-accent-purple to match the Aura sidebar styling.
   */
  orientation?: "horizontal" | "vertical";
}

// ---------------------------------------------------------------------------
// FolderTab — pill-style horizontal tab. Each tab is a drop target.
// ---------------------------------------------------------------------------

interface FolderTabProps {
  droppableId: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
  orientation?: "horizontal" | "vertical";
}

function FolderTab({
  droppableId,
  label,
  isActive,
  onClick,
  actions,
  orientation = "horizontal",
}: FolderTabProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const isVertical = orientation === "vertical";
  const buttonClass = isVertical
    ? [
        "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        isActive
          ? "bg-accent-purple/10 font-semibold text-accent-purple"
          : "text-text-muted hover:bg-surface-elevated hover:text-text-primary",
        isOver ? "ring-2 ring-accent-purple ring-offset-1 ring-offset-bg" : "",
      ]
    : [
        "rounded-full px-4 py-1.5 text-sm transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        isActive
          ? "bg-accent-purple font-semibold text-white shadow-sm"
          : "text-text-muted hover:bg-surface-elevated hover:text-text-primary hover:shadow-sm",
        isOver ? "ring-2 ring-accent-purple ring-offset-2 ring-offset-bg" : "",
      ];

  const actionsClass = isVertical
    ? [
        "pointer-events-none absolute right-1 top-1/2 -translate-y-1/2",
        "opacity-0 transition-opacity duration-150",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        "focus-within:pointer-events-auto focus-within:opacity-100",
      ]
    : [
        "pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2",
        "opacity-0 transition-opacity duration-150",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        "focus-within:pointer-events-auto focus-within:opacity-100",
      ];

  return (
    <div
      ref={setNodeRef}
      data-active={isActive}
      data-orientation={orientation}
      className={isVertical ? "group relative w-full" : "group relative"}
    >
      <button type="button" onClick={onClick} className={buttonClass.filter(Boolean).join(" ")}>
        <span className="truncate">{label}</span>
      </button>
      {actions && <div className={actionsClass.join(" ")}>{actions}</div>}
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
  onCreateFolder,
  orientation = "horizontal",
}: FolderTreeProps) {
  const { t } = useTranslation();
  const isVertical = orientation === "vertical";

  const navClass = isVertical
    ? "flex flex-col gap-1"
    : "flex flex-wrap items-center gap-2 border-b border-border/5 pb-6 pt-2";

  return (
    <nav aria-label={t("folder.allCanvases")} className={navClass}>
      {/* Sentinels */}
      <FolderTab
        droppableId="all"
        label={t("folder.allCanvases")}
        isActive={activeFolderId === null}
        onClick={() => onSelectFolder(null)}
        orientation={orientation}
      />
      <FolderTab
        droppableId="unfiled"
        label={t("folder.unfiled")}
        isActive={activeFolderId === "unfiled"}
        onClick={() => onSelectFolder("unfiled")}
        orientation={orientation}
      />
      <FolderTab
        droppableId="shared"
        label={t("dashboard.sharedWithMe")}
        isActive={activeFolderId === "shared"}
        onClick={() => onSelectFolder("shared")}
        orientation={orientation}
      />

      {/* Divider between sentinels and user folders */}
      {folders.length > 0 &&
        (isVertical ? (
          <span className="my-2 h-px w-full bg-border" aria-hidden="true" />
        ) : (
          <span className="mx-1 h-4 w-px bg-accent-purple/10" aria-hidden="true" />
        ))}

      {/* User folders */}
      {folders.map((folder) => (
        <FolderTab
          key={folder.id}
          droppableId={folder.id}
          label={folder.name}
          isActive={activeFolderId === folder.id}
          onClick={() => onSelectFolder(folder.id)}
          orientation={orientation}
          actions={
            (onRenameFolder || onDeleteFolder) && (
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-0.5 shadow-sm">
                {onRenameFolder && (
                  <button
                    type="button"
                    aria-label={t("folder.rename")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameFolder(folder);
                    }}
                    className="rounded p-1 text-text-muted/70 transition-colors hover:bg-surface-elevated hover:text-text-primary"
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
                    className="rounded p-1 text-text-muted/70 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            )
          }
        />
      ))}

      {/* Create folder action — placed at the strip end */}
      {onCreateFolder &&
        (isVertical ? (
          <button
            type="button"
            aria-label={t("folder.create")}
            onClick={onCreateFolder}
            className="mt-1 inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors duration-150 hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <PlusIcon />
            <span>{t("folder.create")}</span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={t("folder.create")}
            onClick={onCreateFolder}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-all duration-150 hover:bg-surface-elevated hover:text-text-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <PlusIcon />
          </button>
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

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-current"
      aria-hidden="true"
    >
      <path d="M8 3.5a.5.5 0 0 1 .5.5v3.5H12a.5.5 0 0 1 0 1H8.5V12a.5.5 0 0 1-1 0V8.5H4a.5.5 0 0 1 0-1h3.5V4a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}
