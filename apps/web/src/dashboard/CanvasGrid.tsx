/**
 * CanvasGrid — presentational grid of canvas cards.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 9
 *
 * Accepts the raw canvases list plus current `searchQuery` + `sortOrder`
 * and renders the resulting `<CanvasCard>` grid. Pure presentational —
 * no data fetching, no mutation.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CanvasCard } from "../components/CanvasCard";
import { FadeIn, StaggerContainer } from "../motion/primitives";
import type { Canvas } from "./useCanvasList";
import type { SortOrder } from "./useSortOrder";

export interface CanvasGridProps {
  canvases: Canvas[];
  searchQuery: string;
  sortOrder: SortOrder;
  onRename: (canvas: Canvas) => void;
  onDelete: (canvas: Canvas) => void;
  onMove: (canvas: Canvas) => void;
  /**
   * Override the empty-state message when the canvas list is empty AND
   * no search query is active. Defaults to `dashboard.empty.owned`. When
   * a search query is active, the grid always uses
   * `dashboard.empty.searchNoMatch` regardless of this prop.
   */
  emptyMessageKey?: string;
}

function compareByUpdatedDesc(a: Canvas, b: Canvas): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function compareByTitleAsc(a: Canvas, b: Canvas): number {
  return a.title.localeCompare(b.title);
}

export function CanvasGrid({
  canvases,
  searchQuery,
  sortOrder,
  onRename,
  onDelete,
  onMove,
  emptyMessageKey = "dashboard.empty.owned",
}: CanvasGridProps) {
  const { t } = useTranslation();

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q ? canvases.filter((c) => c.title.toLowerCase().includes(q)) : canvases;
    const sorted = [...filtered].sort(
      sortOrder === "alphabetical" ? compareByTitleAsc : compareByUpdatedDesc,
    );
    return sorted;
  }, [canvases, searchQuery, sortOrder]);

  if (visible.length === 0) {
    const emptyMessage = searchQuery.trim()
      ? t("dashboard.empty.searchNoMatch", { query: searchQuery })
      : t(emptyMessageKey);
    return (
      <p data-testid="canvas-grid-empty" className="text-sm text-text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      data-testid="canvas-grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <StaggerContainer staggerMs={80} className="contents">
        {visible.map((canvas) => (
          <div key={canvas.id} data-testid={`canvas-card-${canvas.id}`}>
            <FadeIn duration={400}>
              <CanvasCard canvas={canvas} onRename={onRename} onDelete={onDelete} onMove={onMove} />
            </FadeIn>
          </div>
        ))}
      </StaggerContainer>
    </div>
  );
}
