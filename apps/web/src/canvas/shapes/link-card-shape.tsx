/**
 * link-card-shape — view component for the Link card shape.
 *
 * State-driven rendering:
 *   pending → spinner + localized "Loading…" text
 *   success → OG card (image, title, description, site name)
 *   error   → "Preview unavailable" placeholder + favicon + retry
 *
 * Lock state shows a badge in the upper-right (per multiplayer-sync).
 *
 * Spec: canvas-shapes — Link card transitions through pending / success
 * / error states.
 */

import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LinkCardStored } from "./link-card-state";

export interface LinkCardLockedBy {
  userId: string;
  userName: string;
}

export interface LinkCardShapeViewProps {
  stored: LinkCardStored;
  locked: boolean;
  lockedBy: LinkCardLockedBy | null;
  onRetry: () => void;
}

function originFavicon(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

export function LinkCardShapeView({ stored, locked, lockedBy, onRetry }: LinkCardShapeViewProps) {
  const { t } = useTranslation();
  const faviconUrl = stored.metadata?.favicon ?? originFavicon(stored.url);

  return (
    <div
      data-testid="link-card-shape-root"
      className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      {locked && lockedBy && (
        <span
          data-testid="link-card-shape-lock-badge"
          className="absolute right-2 top-2 z-10 rounded-md bg-accent-purple/85 px-2 py-1 text-xs font-medium text-white"
        >
          {t("shapes.common.lockedBy", { name: lockedBy.userName })}
        </span>
      )}

      {stored.state === "pending" && (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{t("shapes.linkCard.loading")}</span>
        </div>
      )}

      {stored.state === "success" && stored.metadata && (
        <a
          href={stored.url}
          target="_blank"
          rel="noopener noreferrer"
          // Browsers default <a draggable> to true and start a native
          // link drag — that competes with tldraw's shape drag, so the
          // user ends up dropping a copy of the link instead of moving
          // the shape. Disable native drag here.
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="flex h-full flex-col"
        >
          {stored.metadata.image && (
            <img
              src={stored.metadata.image}
              alt=""
              draggable={false}
              className="h-32 w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex flex-1 flex-col gap-1 p-3">
            {stored.metadata.title && (
              <span className="line-clamp-2 text-sm font-semibold text-text-primary">
                {stored.metadata.title}
              </span>
            )}
            {stored.metadata.description && (
              <span className="line-clamp-2 text-xs text-text-muted">
                {stored.metadata.description}
              </span>
            )}
            <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-text-muted">
              {faviconUrl && (
                <img
                  data-testid="link-card-favicon"
                  src={faviconUrl}
                  alt=""
                  draggable={false}
                  className="h-3.5 w-3.5"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {stored.metadata.siteName && <span>{stored.metadata.siteName}</span>}
            </div>
          </div>
        </a>
      )}

      {stored.state === "error" && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          {faviconUrl && (
            <img
              data-testid="link-card-favicon"
              src={faviconUrl}
              alt=""
              draggable={false}
              className="h-6 w-6 opacity-80"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-sm text-text-muted">{t("shapes.linkCard.previewUnavailable")}</span>
          <span className="break-all text-xs text-text-muted">{stored.url}</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={locked}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-elevated disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            {t("shapes.linkCard.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
