/**
 * link-card-state — pure state machine for the Link card shape.
 *
 * The shape stores `{ state, url, metadata, fetchedAt }` in tldraw props.
 * `nextLinkCardState` advances the stored value in response to fetch
 * outcomes, user actions (retry / URL edit), and time (stale auto-refresh
 * on render). Pure function: no side effects, no I/O — caller is
 * responsible for issuing the fetch and propagating the new stored value
 * back to tldraw via editor.updateShape.
 *
 * Spec: canvas-shapes — "Link card shape transitions through pending /
 * success / error states".
 */

export type LinkCardState = "pending" | "success" | "error";

export interface LinkCardMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

export interface LinkCardStored {
  state: LinkCardState;
  url: string;
  metadata: LinkCardMetadata | null;
  fetchedAt: string | null;
}

export type LinkCardEvent =
  | { kind: "fetch-success"; metadata: LinkCardMetadata; fetchedAt: string }
  | { kind: "fetch-error" }
  | { kind: "retry" }
  | { kind: "url-change"; newUrl: string }
  | { kind: "render"; nowIso: string };

/** 24 hours: cards older than this auto-refresh on render. */
export const STALE_TTL_MS = 24 * 60 * 60 * 1000;

export function isStale(fetchedAt: string | null, nowIso: string): boolean {
  if (!fetchedAt) return true;
  const fetched = Date.parse(fetchedAt);
  const now = Date.parse(nowIso);
  if (Number.isNaN(fetched) || Number.isNaN(now)) return true;
  return now - fetched >= STALE_TTL_MS;
}

export function nextLinkCardState(current: LinkCardStored, event: LinkCardEvent): LinkCardStored {
  switch (event.kind) {
    case "fetch-success":
      return {
        ...current,
        state: "success",
        metadata: event.metadata,
        fetchedAt: event.fetchedAt,
      };
    case "fetch-error":
      return { ...current, state: "error", metadata: null, fetchedAt: null };
    case "retry":
      return { ...current, state: "pending", metadata: null, fetchedAt: null };
    case "url-change": {
      if (event.newUrl === current.url) return current;
      return {
        state: "pending",
        url: event.newUrl,
        metadata: null,
        fetchedAt: null,
      };
    }
    case "render": {
      // Stale auto-refresh applies only to success state. Pending / error
      // already trigger their own fetches; render is a no-op for them.
      if (current.state !== "success") return current;
      if (!isStale(current.fetchedAt, event.nowIso)) return current;
      return { ...current, state: "pending", metadata: null, fetchedAt: null };
    }
  }
}
