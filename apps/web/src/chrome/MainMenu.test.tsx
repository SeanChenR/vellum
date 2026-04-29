/**
 * MainMenu.test.tsx — TDD tests for the MainMenu chrome component.
 *
 * Covers spec: "MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu"
 *
 * Tests use Testing Library + userEvent.
 * i18n locale set to English for exact string assertions.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { MainMenu } from "./MainMenu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderMainMenuOptions {
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function renderMainMenu(opts: RenderMainMenuOptions = {}) {
  const onRename = opts.onRename ?? mock(() => {});
  const onDuplicate = opts.onDuplicate ?? mock(() => {});
  const onDelete = opts.onDelete ?? mock(() => {});

  render(
    <I18nextProvider i18n={i18n}>
      <MainMenu onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
    </I18nextProvider>,
  );

  return { onRename, onDuplicate, onDelete };
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
// Tests (task 5.2)
// ---------------------------------------------------------------------------

describe("MainMenu", () => {
  // (a) menu shows 4 items in order: Rename / Duplicate / Delete / Export
  test("opening menu shows four items in order: Rename, Duplicate, Delete, Export", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    // Click the menu trigger button
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).not.toBeNull();
    });
    const items = screen.getAllByRole("menuitem");
    // At minimum 4 top-level items visible: Rename, Duplicate, Delete, Export
    const texts = items.map((el) => el.textContent?.trim() ?? "");
    expect(texts[0]).toMatch(/rename/i);
    expect(texts[1]).toMatch(/duplicate/i);
    expect(texts[2]).toMatch(/delete/i);
    expect(texts[3]).toMatch(/export/i);
  });

  // (b) clicking Rename triggers onRename
  test("clicking Rename calls onRename", async () => {
    const user = userEvent.setup();
    const onRename = mock(() => {});
    renderMainMenu({ onRename });
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).not.toBeNull();
    });
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  // (c) clicking Duplicate triggers onDuplicate
  test("clicking Duplicate calls onDuplicate", async () => {
    const user = userEvent.setup();
    const onDuplicate = mock(() => {});
    renderMainMenu({ onDuplicate });
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).not.toBeNull();
    });
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  // (d) clicking Delete opens confirm dialog; confirm calls onDelete, cancel does not
  test("clicking Delete opens confirm dialog; confirm calls onDelete", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    renderMainMenu({ onDelete });
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).not.toBeNull();
    });
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).not.toBeNull();
    });
    // Click confirm
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("clicking Delete then Cancel does NOT call onDelete", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    renderMainMenu({ onDelete });
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).not.toBeNull();
    });
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).not.toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  // (e) Export submenu shows 5 disabled items with "coming soon" text
  test("Export submenu shows 5 disabled items with coming-soon text", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).not.toBeNull();
    });
    // Hover/click the Export item to reveal submenu
    const exportItem = screen.getByRole("menuitem", { name: /export/i });
    await user.hover(exportItem);
    await waitFor(() => {
      const comingSoonItems = screen
        .getAllByRole("menuitem")
        .filter((el) => el.getAttribute("aria-disabled") === "true");
      expect(comingSoonItems.length).toBeGreaterThanOrEqual(5);
      const allText = comingSoonItems.map((el) => el.textContent?.toLowerCase() ?? "").join(" ");
      expect(allText).toMatch(/coming soon/);
    });
  });
});
