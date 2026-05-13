/**
 * DashboardSidebar — left column of the dashboard.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 9
 * Spec ref:   openspec/specs/public-pages/spec.md
 *   "Sidebar folder active state uses accent-purple-soft"
 *
 * Composition:
 *   - Folders heading + FolderTree (vertical orientation; DnD preserved)
 *   - Tags heading + Badge tag chips (purely visual until tagging
 *     ships in a later milestone — accepts any string[] prop)
 *
 * The sort toggle was moved out of the sidebar into the canvas section
 * header (see SortToggle.tsx) so the control sits next to the content
 * it affects.
 */

import { useTranslation } from "react-i18next";
import { FolderTree } from "../components/FolderTree";
import type { Folder } from "./useFolderList";
import { Badge, type BadgeTone } from "../components/ui/Badge";

export interface DashboardSidebarProps {
  folders: Folder[];
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  onCreateFolder?: () => void;
  tags?: readonly string[];
}

const TAG_TONES: BadgeTone[] = ["purple", "cyan", "orange", "muted"];

export function DashboardSidebar({
  folders,
  activeFolderId,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateFolder,
  tags = [],
}: DashboardSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("dashboard.sidebar.foldersHeading")}
        </h3>
        <FolderTree
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onCreateFolder={onCreateFolder}
          orientation="vertical"
        />
      </section>

      {tags.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t("dashboard.sidebar.tagsHeading")}
          </h3>
          <div className="flex flex-wrap gap-2 px-1">
            {tags.map((tag, idx) => (
              <Badge
                key={tag}
                tone={TAG_TONES[idx % TAG_TONES.length] ?? "muted"}
                data-testid="dashboard-sidebar-tag"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
