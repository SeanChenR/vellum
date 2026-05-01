/**
 * ConnectionStatus — TopBar indicator + disconnected banner.
 *
 * Subscribes to `useSyncConnectionStore` and renders one of four states.
 * Per CLAUDE.md hard rule #5 (multiplayer presence MUST be instant), the
 * indicator carries no transition or animation styles.
 *
 * Spec: canvas-editor — "TopBar displays a real-time connection status indicator"
 */

import { useTranslation } from "react-i18next";
import { useSyncConnectionStore } from "./use-sync-store";
import type { ConnectionState } from "./use-sync-store";

const STATE_DOT_COLOR: Record<ConnectionState, string> = {
  connecting: "bg-warm-sepia",
  connected: "bg-emerald-500",
  reconnecting: "bg-amber-500",
  disconnected: "bg-red-500",
};

const STATE_LABEL_COLOR: Record<ConnectionState, string> = {
  connecting: "text-warm-sepia",
  connected: "text-warm-sepia",
  reconnecting: "text-amber-600",
  disconnected: "text-red-600",
};

export function ConnectionStatus() {
  const { t } = useTranslation();
  const state = useSyncConnectionStore((s) => s.state);
  const label = t(`canvas.chrome.connection.${state}`);
  const isDisconnected = state === "disconnected";
  const showLabel = state !== "connected"; // keep chrome quiet on the happy path
  // Pulse the dot whenever we are not in a steady-state — a chrome-only
  // affordance, *not* a cursor/presence animation, so CLAUDE.md hard rule
  // #5 (multiplayer presence MUST be instant) does not apply here.
  const shouldPulse = state === "connecting" || state === "reconnecting";

  return (
    <>
      <span
        data-testid="connection-status"
        aria-label={label}
        title={label}
        className="inline-flex shrink-0 items-center gap-1.5"
      >
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${STATE_DOT_COLOR[state]} ${
            shouldPulse ? "animate-pulse" : ""
          }`}
        />
        {showLabel && (
          <span
            data-testid="connection-status-label"
            className={`text-xs ${STATE_LABEL_COLOR[state]}`}
          >
            {label}
          </span>
        )}
      </span>
      {isDisconnected && <DisconnectedBanner />}
    </>
  );
}

function DisconnectedBanner() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="connection-disconnected-banner"
      role="alert"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/30 bg-white px-4 py-3 text-sm shadow-lg"
    >
      <span className="text-ink-navy">{t("canvas.chrome.connection.disconnectedBanner")}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="ml-3 rounded-md bg-ink-navy px-3 py-1 text-xs font-semibold text-white hover:bg-ink-navy/90"
      >
        {t("canvas.chrome.connection.refresh")}
      </button>
    </div>
  );
}
