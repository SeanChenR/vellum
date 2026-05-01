/**
 * ConnectionStatus tests (task 4.2).
 *
 * Covers spec requirement:
 *   "TopBar displays a real-time connection status indicator"
 *
 * Verifies four-state rendering, localized aria-label keys, the
 * disconnected banner + refresh action, and the absence of any motion
 * animation on the indicator (CLAUDE.md hard rule #5: presence MUST
 * be instant).
 */

import "../i18n";
import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { ConnectionStatus } from "./ConnectionStatus";
import type { ConnectionState } from "./use-sync-store";
import { useSyncConnectionStore } from "./use-sync-store";

afterEach(() => {
  cleanup();
  useSyncConnectionStore.setState({ state: "connecting", attempt: 0 });
});

function renderWithState(state: ConnectionState) {
  useSyncConnectionStore.setState({ state, attempt: 0 });
  return render(
    <I18nextProvider i18n={i18n}>
      <ConnectionStatus />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// State → label/aria mapping
// ---------------------------------------------------------------------------

const STATE_TO_LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

describe("indicator state → localized label and aria-label", () => {
  for (const [state, label] of Object.entries(STATE_TO_LABEL)) {
    test(`state=${state} renders label "${label}" and matching aria-label`, () => {
      renderWithState(state as ConnectionState);
      const indicator = screen.getByTestId("connection-status");
      expect(indicator.getAttribute("aria-label")).toBe(label);
    });
  }
});

describe("indicator updates when the connection state changes", () => {
  test("re-renders when the Zustand store transitions", () => {
    renderWithState("connecting");
    expect(screen.getByTestId("connection-status").getAttribute("aria-label")).toBe(
      STATE_TO_LABEL.connecting,
    );

    act(() => {
      useSyncConnectionStore.setState({ state: "connected" });
    });
    expect(screen.getByTestId("connection-status").getAttribute("aria-label")).toBe(
      STATE_TO_LABEL.connected,
    );

    act(() => {
      useSyncConnectionStore.setState({ state: "reconnecting" });
    });
    expect(screen.getByTestId("connection-status").getAttribute("aria-label")).toBe(
      STATE_TO_LABEL.reconnecting,
    );
  });
});

// ---------------------------------------------------------------------------
// Disconnected banner + refresh action
// ---------------------------------------------------------------------------

describe("disconnected banner", () => {
  test("not shown while connecting/connected/reconnecting", () => {
    for (const state of ["connecting", "connected", "reconnecting"] as ConnectionState[]) {
      cleanup();
      renderWithState(state);
      expect(screen.queryByTestId("connection-disconnected-banner")).toBeNull();
    }
  });

  test("shown when state is disconnected with localized body and refresh action", () => {
    renderWithState("disconnected");
    const banner = screen.getByTestId("connection-disconnected-banner");
    expect(banner.textContent).toContain("Lost connection to the canvas");
    const refresh = screen.getByRole("button", { name: "Refresh" });
    expect(refresh).not.toBeNull();
  });

  test("clicking refresh triggers a page reload", () => {
    let reloaded = false;
    const original = window.location.reload;
    Object.defineProperty(window.location, "reload", {
      configurable: true,
      value: () => {
        reloaded = true;
      },
    });

    renderWithState("disconnected");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(reloaded).toBe(true);

    Object.defineProperty(window.location, "reload", {
      configurable: true,
      value: original,
    });
  });
});

// ---------------------------------------------------------------------------
// No motion animation
// ---------------------------------------------------------------------------

describe("no motion animation on the indicator", () => {
  test("the indicator MUST NOT carry transition / animation inline styles", () => {
    renderWithState("connecting");
    const indicator = screen.getByTestId("connection-status");
    const style = (indicator as HTMLElement).style;
    expect(style.transition || "").toBe("");
    expect(style.animation || "").toBe("");
  });
});
