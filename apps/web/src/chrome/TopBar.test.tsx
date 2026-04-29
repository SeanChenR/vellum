/**
 * TopBar.test.tsx — TDD tests for the TopBar chrome component.
 *
 * Covers spec: "TopBar exposes canvas title, folder breadcrumb, share placeholder, and user menu"
 *
 * Tests use Testing Library + userEvent.
 * i18n is set to English (en) for exact string assertions.
 */

import "../i18n"; // initialise i18n before tests
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { TopBar } from "./TopBar";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeUser() {
  return {
    id: "u1",
    email: "test@example.com",
    name: "Test User",
    image: null,
    locale: "en" as const,
    createdAt: new Date().toISOString(),
  };
}

interface RenderTopBarOptions {
  title?: string;
  folder?: { id: string; name: string } | null;
  onShareClick?: () => void;
  onRenameSubmit?: (_newTitle: string) => void;
  onSignOut?: () => void;
}

function renderTopBar(opts: RenderTopBarOptions = {}) {
  const onShareClick = opts.onShareClick ?? mock(() => {});
  const onRenameSubmit = opts.onRenameSubmit ?? mock((_t: string) => {});
  const onSignOut = opts.onSignOut ?? mock(() => {});

  render(
    <I18nextProvider i18n={i18n}>
      <TopBar
        canvasId="canvas-1"
        title={opts.title ?? "My Canvas"}
        folder={opts.folder !== undefined ? opts.folder : null}
        onShareClick={onShareClick}
        onRenameSubmit={onRenameSubmit}
        currentUser={makeUser()}
        onSignOut={onSignOut}
      />
    </I18nextProvider>,
  );

  return { onShareClick, onRenameSubmit, onSignOut };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests (task 5.1)
// ---------------------------------------------------------------------------

describe("TopBar", () => {
  // (a) folder breadcrumb shows folder name
  test("shows folder name in breadcrumb when folder prop is provided", () => {
    renderTopBar({ folder: { id: "f1", name: "Inbox" } });
    expect(screen.getByText("Inbox")).not.toBeNull();
  });

  // (b) no folder → shows i18n key canvas.chrome.topbar.breadcrumb.myCanvases
  test("shows 'My canvases' breadcrumb when folder is null", async () => {
    renderTopBar({ folder: null });
    // en translation for canvas.chrome.topbar.breadcrumb.myCanvases
    await waitFor(() => {
      expect(screen.getByText("My canvases")).not.toBeNull();
    });
  });

  // (c) share button invokes onShareClick once
  test("clicking Share button calls onShareClick once", async () => {
    const user = userEvent.setup();
    const onShareClick = mock(() => {});
    renderTopBar({ onShareClick });
    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(onShareClick).toHaveBeenCalledTimes(1);
  });

  // (d) clicking canvas title opens rename dialog with input focused
  test("clicking canvas title opens rename dialog with input focused", async () => {
    const user = userEvent.setup();
    renderTopBar({ title: "My Canvas" });
    await user.click(screen.getByRole("button", { name: /my canvas/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).not.toBeNull();
    });
    const input = screen.getByRole("textbox");
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  // (e) pressing Escape closes rename dialog without calling rename mutation
  test("Escape in rename dialog closes without calling rename", async () => {
    const user = userEvent.setup();
    const onRenameSubmit = mock((_t: string) => {});
    renderTopBar({ title: "My Canvas", onRenameSubmit });
    await user.click(screen.getByRole("button", { name: /my canvas/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).not.toBeNull();
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(onRenameSubmit).not.toHaveBeenCalled();
  });

  // (f) Enter in rename dialog with new name calls rename mutation and closes dialog
  test("submitting new name in rename dialog calls onRenameSubmit and closes", async () => {
    const user = userEvent.setup();
    const onRenameSubmit = mock((_t: string) => {});
    renderTopBar({ title: "My Canvas", onRenameSubmit });
    await user.click(screen.getByRole("button", { name: /my canvas/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).not.toBeNull();
    });
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Renamed Canvas");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(onRenameSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onRenameSubmit).toHaveBeenCalledWith("Renamed Canvas");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
