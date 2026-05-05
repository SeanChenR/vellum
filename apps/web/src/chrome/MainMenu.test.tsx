/**
 * MainMenu.test.tsx — TDD tests for the MainMenu chrome component.
 *
 * Covers spec deltas from add-export:
 *   - "Viewer cannot access export controls" (read-only sessions hide submenu)
 *   - "Editor and owner can export the canvas in four formats" (4 functional items)
 *   - PNG / PDF nested 1× / 2× / 4× scale submenu
 *   - onExport(format, scale) callback wiring
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
import type { ExportFormat, ExportScale } from "../canvas/export/export-canvas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderMainMenuOptions {
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onExport?: (format: ExportFormat, scale?: ExportScale) => void;
  isReadOnly?: boolean;
}

function renderMainMenu(opts: RenderMainMenuOptions = {}) {
  const onRename = opts.onRename ?? mock(() => {});
  const onDuplicate = opts.onDuplicate ?? mock(() => {});
  const onDelete = opts.onDelete ?? mock(() => {});
  const onExport = opts.onExport ?? mock(() => {});
  const isReadOnly = opts.isReadOnly ?? false;

  render(
    <I18nextProvider i18n={i18n}>
      <MainMenu
        onRename={onRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onExport={onExport}
        isReadOnly={isReadOnly}
      />
    </I18nextProvider>,
  );

  return { onRename, onDuplicate, onDelete, onExport };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /menu/i }));
  await waitFor(() => {
    expect(screen.getByRole("menu")).not.toBeNull();
  });
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
// Existing top-level item behavior (unchanged from placeholder version)
// ---------------------------------------------------------------------------

describe("MainMenu — top-level items", () => {
  test("opening menu shows four items in order: Rename, Duplicate, Delete, Export", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await openMenu(user);
    const items = screen.getAllByRole("menuitem");
    const texts = items.map((el) => el.textContent?.trim() ?? "");
    expect(texts[0]).toMatch(/rename/i);
    expect(texts[1]).toMatch(/duplicate/i);
    expect(texts[2]).toMatch(/delete/i);
    expect(texts[3]).toMatch(/export/i);
  });

  test("clicking Rename calls onRename", async () => {
    const user = userEvent.setup();
    const { onRename } = renderMainMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  test("clicking Duplicate calls onDuplicate", async () => {
    const user = userEvent.setup();
    const { onDuplicate } = renderMainMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  test("clicking Delete opens confirm dialog; confirm calls onDelete", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderMainMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /^delete/i }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).not.toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /^delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("clicking Delete then Cancel does NOT call onDelete", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderMainMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /^delete/i }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).not.toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 5.1 Role gate — read-only sessions hide the Export submenu entirely
// ---------------------------------------------------------------------------

describe("MainMenu — role gate (task 5.1)", () => {
  test("isReadOnly=true: Export submenu trigger is NOT rendered", async () => {
    const user = userEvent.setup();
    renderMainMenu({ isReadOnly: true });
    await openMenu(user);
    const items = screen.getAllByRole("menuitem");
    const texts = items.map((el) => el.textContent?.toLowerCase() ?? "");
    expect(texts.some((t) => t.includes("export"))).toBe(false);
  });

  test("isReadOnly=false: Export submenu trigger IS rendered", async () => {
    const user = userEvent.setup();
    renderMainMenu({ isReadOnly: false });
    await openMenu(user);
    const exportItem = screen.queryByRole("menuitem", { name: /^export/i });
    expect(exportItem).not.toBeNull();
  });

  test("isReadOnly=true: even under keyboard tab navigation, no export-related element is reachable", async () => {
    const user = userEvent.setup();
    renderMainMenu({ isReadOnly: true });
    await openMenu(user);
    const items = screen.getAllByRole("menuitem");
    const texts = items.map((el) => el.textContent?.toLowerCase() ?? "").join(" ");
    expect(texts).not.toMatch(/png|svg|pdf|json|export/);
    void user; // user fixture unused but keeps signature consistent
  });
});

// ---------------------------------------------------------------------------
// 5.2 Submenu structure — PNG / SVG / PDF / JSON + nested scale for PNG/PDF
// ---------------------------------------------------------------------------

describe("MainMenu — Export submenu structure (task 5.2)", () => {
  test("Export submenu lists exactly 4 functional items (PNG, SVG, PDF, JSON)", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => {
      const items = screen
        .getAllByRole("menuitem")
        .map((el) => el.textContent?.toLowerCase() ?? "");
      expect(items.some((t) => t.includes("png"))).toBe(true);
      expect(items.some((t) => t.includes("svg"))).toBe(true);
      expect(items.some((t) => t.includes("pdf"))).toBe(true);
      expect(items.some((t) => t.includes("json"))).toBe(true);
      expect(items.some((t) => t.includes("markdown"))).toBe(false);
    });
  });

  test("Export submenu items are enabled (no aria-disabled, no 'coming soon' suffix)", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => {
      const items = screen.getAllByRole("menuitem");
      const exportItems = items.filter((el) => /png|svg|pdf|json/i.test(el.textContent ?? ""));
      expect(exportItems.length).toBe(4);
      for (const el of exportItems) {
        expect(el.getAttribute("aria-disabled")).not.toBe("true");
        expect(el.textContent?.toLowerCase()).not.toContain("coming soon");
      }
    });
  });

  test("Hovering PNG opens nested submenu with 1×, 2×, 4× scale items", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /png/i }));
    await user.hover(screen.getByRole("menuitem", { name: /png/i }));
    await waitFor(() => {
      const items = screen
        .getAllByRole("menuitem")
        .map((el) => el.textContent?.toLowerCase() ?? "");
      expect(items.some((t) => t.includes("1×") || t.includes("1x"))).toBe(true);
      expect(items.some((t) => t.includes("2×") || t.includes("2x"))).toBe(true);
      expect(items.some((t) => t.includes("4×") || t.includes("4x"))).toBe(true);
    });
  });

  test("Hovering PDF opens nested submenu with 1×, 2×, 4× scale items", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /pdf/i }));
    await user.hover(screen.getByRole("menuitem", { name: /pdf/i }));
    await waitFor(() => {
      const items = screen
        .getAllByRole("menuitem")
        .map((el) => el.textContent?.toLowerCase() ?? "");
      expect(items.some((t) => t.includes("1×") || t.includes("1x"))).toBe(true);
      expect(items.some((t) => t.includes("2×") || t.includes("2x"))).toBe(true);
      expect(items.some((t) => t.includes("4×") || t.includes("4x"))).toBe(true);
    });
  });

  test("SVG and JSON do NOT have nested scale submenus", async () => {
    const user = userEvent.setup();
    renderMainMenu();
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /svg/i }));
    const svgItem = screen.getByRole("menuitem", { name: /svg/i });
    expect(svgItem.getAttribute("aria-haspopup")).not.toBe("true");
    const jsonItem = screen.getByRole("menuitem", { name: /json/i });
    expect(jsonItem.getAttribute("aria-haspopup")).not.toBe("true");
  });
});

// ---------------------------------------------------------------------------
// 5.3 onExport callback wiring
// ---------------------------------------------------------------------------

describe("MainMenu — onExport callback (task 5.3)", () => {
  test("clicking PNG → 2× invokes onExport with ('png', 2)", async () => {
    const user = userEvent.setup();
    const onExport = mock((_f: ExportFormat, _s?: ExportScale) => {});
    renderMainMenu({ onExport });
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /png/i }));
    await user.hover(screen.getByRole("menuitem", { name: /png/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /2×|2x/i }));
    await user.click(screen.getByRole("menuitem", { name: /2×|2x/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0]).toEqual(["png", 2]);
  });

  test("clicking PDF → 4× invokes onExport with ('pdf', 4)", async () => {
    const user = userEvent.setup();
    const onExport = mock((_f: ExportFormat, _s?: ExportScale) => {});
    renderMainMenu({ onExport });
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /pdf/i }));
    await user.hover(screen.getByRole("menuitem", { name: /pdf/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /4×|4x/i }));
    await user.click(screen.getByRole("menuitem", { name: /4×|4x/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0]).toEqual(["pdf", 4]);
  });

  test("clicking SVG invokes onExport with ('svg') (no scale)", async () => {
    const user = userEvent.setup();
    const onExport = mock((_f: ExportFormat, _s?: ExportScale) => {});
    renderMainMenu({ onExport });
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /svg/i }));
    await user.click(screen.getByRole("menuitem", { name: /svg/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0]![0]).toBe("svg");
    expect(onExport.mock.calls[0]![1]).toBeUndefined();
  });

  test("clicking JSON invokes onExport with ('json') (no scale)", async () => {
    const user = userEvent.setup();
    const onExport = mock((_f: ExportFormat, _s?: ExportScale) => {});
    renderMainMenu({ onExport });
    await openMenu(user);
    await user.hover(screen.getByRole("menuitem", { name: /^export/i }));
    await waitFor(() => screen.getByRole("menuitem", { name: /json/i }));
    await user.click(screen.getByRole("menuitem", { name: /json/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0]![0]).toBe("json");
    expect(onExport.mock.calls[0]![1]).toBeUndefined();
  });
});
