/**
 * CanvasGrid tests — design Decision 9.
 *
 * Presentational grid that consumes a canvas list + search query + sort
 * order and renders matching `<CanvasCard>` items.
 */

import "../i18n";
import React from "react";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

const RealRouter = await import("@tanstack/react-router");
mock.module("@tanstack/react-router", () => ({
  ...RealRouter,
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { CanvasGrid } = await import("./CanvasGrid");
type Canvas = import("./useCanvasList").Canvas;

const CANVASES: Canvas[] = [
  {
    id: "c-1",
    ownerId: "u-1",
    folderId: null,
    title: "Zeta sketch",
    snapshot: {},
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-13T10:00:00.000Z",
  },
  {
    id: "c-2",
    ownerId: "u-1",
    folderId: null,
    title: "Alpha brief",
    snapshot: {},
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-12T10:00:00.000Z",
  },
  {
    id: "c-3",
    ownerId: "u-1",
    folderId: null,
    title: "Mu design",
    snapshot: {},
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-11T10:00:00.000Z",
  },
];

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => cleanup());

function renderGrid(overrides: Partial<Parameters<typeof CanvasGrid>[0]> = {}) {
  const props: Parameters<typeof CanvasGrid>[0] = {
    canvases: CANVASES,
    searchQuery: "",
    sortOrder: "recent",
    onRename: mock(() => {}),
    onDelete: mock(() => {}),
    onMove: mock(() => {}),
    ...overrides,
  };
  return render(
    <DndContext>
      <I18nextProvider i18n={i18n}>
        <CanvasGrid {...props} />
      </I18nextProvider>
    </DndContext>,
  );
}

describe("CanvasGrid", () => {
  test("renders one CanvasCard per canvas", () => {
    renderGrid();
    const cards = document.querySelectorAll('[data-testid^="canvas-card-"]');
    expect(cards).toHaveLength(3);
  });

  test("recent sort orders by updatedAt DESC", () => {
    renderGrid({ sortOrder: "recent" });
    const cards = document.querySelectorAll('[data-testid^="canvas-card-"]');
    expect(cards[0]!.getAttribute("data-testid")).toBe("canvas-card-c-1");
    expect(cards[1]!.getAttribute("data-testid")).toBe("canvas-card-c-2");
    expect(cards[2]!.getAttribute("data-testid")).toBe("canvas-card-c-3");
  });

  test("alphabetical sort orders by title localeCompare ASC", () => {
    renderGrid({ sortOrder: "alphabetical" });
    const cards = document.querySelectorAll('[data-testid^="canvas-card-"]');
    expect(cards[0]!.getAttribute("data-testid")).toBe("canvas-card-c-2");
    expect(cards[1]!.getAttribute("data-testid")).toBe("canvas-card-c-3");
    expect(cards[2]!.getAttribute("data-testid")).toBe("canvas-card-c-1");
  });

  test("search query filters titles in place (case-insensitive)", () => {
    renderGrid({ searchQuery: "alp" });
    const cards = document.querySelectorAll('[data-testid^="canvas-card-"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.getAttribute("data-testid")).toBe("canvas-card-c-2");
  });

  test("empty list renders the empty-state copy", () => {
    renderGrid({ canvases: [] });
    expect(screen.queryByTestId("canvas-grid-empty")).not.toBeNull();
  });

  test("search query with no match shows empty-state with the query in the copy", () => {
    renderGrid({ searchQuery: "nonexistent" });
    const empty = screen.getByTestId("canvas-grid-empty");
    expect(empty.textContent).toContain("nonexistent");
  });

  test("grid container uses grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", () => {
    renderGrid();
    const grid = document.querySelector('[data-testid="canvas-grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.className).toContain("grid-cols-1");
    expect(grid!.className).toContain("sm:grid-cols-2");
    expect(grid!.className).toContain("lg:grid-cols-3");
    expect(grid!.className).toContain("xl:grid-cols-4");
  });
});
