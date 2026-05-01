/**
 * use-sync-store — multiplayer sync hook + reconnection library.
 *
 * Public surface:
 *   - `useSyncStore(canvasId)` — React hook returning `{ status, store }` for
 *     <Tldraw store={store} /> integration
 *   - `useSyncConnectionStore` — Zustand store exposing the four-state
 *     connection indicator (`connecting`/`connected`/`reconnecting`/`disconnected`)
 *   - `SyncReconnectController` — exponential-backoff-with-jitter reconnect
 *     scheduler. Library-level helper; today the underlying `@tldraw/sync`
 *     hook handles its own reconnect, but the controller is unit-tested
 *     and ready to wire when we replace the upstream client.
 *
 * Spec: multiplayer-sync — "Client reconnects with exponential backoff and
 * stops on permanent failures"; canvas-editor — "TopBar displays a real-time
 * connection status indicator".
 */

import { useEffect, useMemo } from "react";
import { useSync, type RemoteTLStoreWithStatus } from "@tldraw/sync";
import type { TLAssetStore } from "tldraw";
import { create } from "zustand";
import { useAuth } from "../auth/useAuth";

// ---------------------------------------------------------------------------
// Public types + constants
// ---------------------------------------------------------------------------

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export const RECONNECT_BACKOFF_MS: readonly number[] = [
  1_000, 2_000, 4_000, 8_000, 16_000,
] as const;

export const PERMANENT_CLOSE_CODES: ReadonlySet<number> = new Set([4401, 4403, 4404, 4429]);

const JITTER_RATIO = 0.2;

// ---------------------------------------------------------------------------
// Zustand connection store
// ---------------------------------------------------------------------------

export interface SyncConnectionStoreState {
  state: ConnectionState;
  attempt: number;
}

export const useSyncConnectionStore = create<SyncConnectionStoreState>(() => ({
  state: "connecting",
  attempt: 0,
}));

// ---------------------------------------------------------------------------
// Reconnect controller — exponential backoff with jitter
// ---------------------------------------------------------------------------

export interface ReconnectControllerOptions {
  /** Invoked when a reconnect attempt fires. */
  reconnect: () => void;
  /** Test injection for `setTimeout`. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  /** Test injection for `clearTimeout`. */
  clearTimer?: (handle: unknown) => void;
  /** Test injection for `Math.random`. */
  random?: () => number;
}

export class SyncReconnectController {
  readonly #opts: ReconnectControllerOptions;
  readonly #setTimer: (fn: () => void, ms: number) => unknown;
  readonly #clearTimer: (handle: unknown) => void;
  readonly #random: () => number;
  #timer: unknown = null;
  #attempt = 0;

  constructor(opts: ReconnectControllerOptions) {
    this.#opts = opts;
    this.#setTimer = opts.setTimer ?? ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown);
    this.#clearTimer =
      opts.clearTimer ??
      ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.#random = opts.random ?? Math.random;
  }

  /**
   * Notify of a WebSocket close. Returns the next connection state.
   *   - permanent close codes → `disconnected` (no retry scheduled)
   *   - exhausted attempts    → `disconnected`
   *   - otherwise             → `reconnecting` with a fresh timer
   */
  handleClose(code: number): ConnectionState {
    this.#cancelInternal();

    if (PERMANENT_CLOSE_CODES.has(code)) {
      this.#attempt = RECONNECT_BACKOFF_MS.length;
      return "disconnected";
    }

    if (this.#attempt >= RECONNECT_BACKOFF_MS.length) {
      return "disconnected";
    }

    const base = RECONNECT_BACKOFF_MS[this.#attempt]!;
    const jitter = (this.#random() - 0.5) * 2 * JITTER_RATIO;
    const delay = Math.round(base * (1 + jitter));
    this.#attempt += 1;

    this.#timer = this.#setTimer(() => {
      this.#timer = null;
      this.#opts.reconnect();
    }, delay);

    return "reconnecting";
  }

  /** Notify of a successful WebSocket open — resets attempt counter. */
  handleOpen(): void {
    this.#cancelInternal();
    this.#attempt = 0;
  }

  /** Cancel any pending reconnect timer (e.g., on unmount). */
  cancel(): void {
    this.#cancelInternal();
  }

  // Test-only introspection.
  getAttempt(): number {
    return this.#attempt;
  }

  #cancelInternal(): void {
    if (this.#timer !== null) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// useSyncStore — React hook
// ---------------------------------------------------------------------------

/**
 * Phase 1 asset store: upload is unsupported (PRD out-of-scope), tldraw's
 * built-in `image` shape stores small assets inline as base64 / object URLs.
 */
const inlineAssetStore: TLAssetStore = {
  async upload() {
    throw new Error("Asset upload is not supported in phase 1 (see docs/PRD.md).");
  },
  resolve(asset) {
    const src = (asset.props as { src?: string }).src;
    return src ?? null;
  },
};

export interface UseSyncStoreResult {
  status: "loading" | "ready" | "error";
  store: RemoteTLStoreWithStatus["store"] | null;
}

function syncOriginForCanvas(canvasId: string): string {
  // In production the single-binary Bun.serve handles HTTP and the sync
  // WebSocket on the same host — same-origin URI works.
  //
  // In `bun run dev:up` the browser hits the proxy on :3002 which forwards
  // `/api/*` to the API on :3000 but NOT `/sync/*` (Bun has no built-in WS
  // proxy). So in dev we bypass the proxy for WS and connect straight to
  // the API; the better-auth session cookie has no Domain attribute and
  // localhost:3000 / localhost:3002 are same-site, so SameSite=Lax still
  // sends it on the upgrade request.
  if (typeof window === "undefined") return `ws://localhost:3000/sync/${canvasId}`;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (window.location.port === "3002") {
    return `${proto}//${window.location.hostname}:3000/sync/${canvasId}`;
  }
  return `${proto}//${window.location.host}/sync/${canvasId}`;
}

/**
 * Stable per-tab presence id so two tabs of the same authenticated user
 * appear as distinct collaborators (otherwise tldraw collapses them and
 * neither tab sees the other's cursor).
 */
const TAB_PRESENCE_SUFFIX = (() => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
})();

/** Deterministic CSS hex colour from a user id — keeps the same person's
 * cursor consistent across reconnects without needing a colour column in
 * the DB. */
function colorFromUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 50%)`;
}

/**
 * Bind a tldraw sync store to `/sync/:canvasId`. Wraps `useSync` from
 * `@tldraw/sync` and forwards its status into `useSyncConnectionStore` so
 * chrome components can subscribe without each rolling their own listener.
 */
export function useSyncStore(canvasId: string): UseSyncStoreResult {
  const { user } = useAuth();
  const uri = useMemo(() => syncOriginForCanvas(canvasId), [canvasId]);

  const userInfo = useMemo(() => {
    if (!user) {
      return { id: `anon:${TAB_PRESENCE_SUFFIX}`, name: "Anonymous", color: "#888888" };
    }
    // Two tabs of the same authenticated user need distinct presence ids
    // for cursors to render between them — append a per-tab random suffix.
    return {
      id: `${user.id}:${TAB_PRESENCE_SUFFIX}`,
      name: user.name || user.email,
      color: colorFromUserId(user.id),
    };
  }, [user]);

  const remote = useSync({
    uri,
    assets: inlineAssetStore,
    userInfo,
  });

  // tldraw keeps `status: synced-remote` even after the WebSocket drops
  // (the store still has data), so to detect "reconnecting" we have to
  // peek at the inner `connectionStatus` field which it exposes alongside.
  const connectionFlag =
    remote.status === "synced-remote"
      ? (remote as { connectionStatus?: "online" | "offline" }).connectionStatus
      : undefined;

  useEffect(() => {
    if (remote.status === "loading") {
      useSyncConnectionStore.setState({ state: "connecting" });
      return;
    }
    if (remote.status === "error") {
      useSyncConnectionStore.setState({ state: "disconnected" });
      return;
    }
    if (remote.status !== "synced-remote") return;

    if (connectionFlag !== "offline") {
      useSyncConnectionStore.setState({ state: "connected", attempt: 0 });
      return;
    }

    // Offline: enter reconnecting and arm a give-up timer. @tldraw/sync's
    // built-in reconnect retries indefinitely, so we layer our own ceiling
    // on top to satisfy the spec's "5 attempts → disconnected" semantics
    // (1 + 2 + 4 + 8 + 16 ≈ 31 s of total backoff).
    useSyncConnectionStore.setState({ state: "reconnecting" });
    const giveUpTimer = globalThis.setTimeout(() => {
      const current = useSyncConnectionStore.getState().state;
      if (current === "reconnecting") {
        useSyncConnectionStore.setState({ state: "disconnected" });
      }
    }, 31_000);
    return () => {
      globalThis.clearTimeout(giveUpTimer);
    };
  }, [remote.status, connectionFlag]);

  if (remote.status === "loading") return { status: "loading", store: null };
  if (remote.status === "error") return { status: "error", store: null };
  return { status: "ready", store: remote.store };
}
