/**
 * FolderTree component tests.
 *
 * Scenarios (spec: "Folder tree component renders flat list with drag targets"):
 * - Renders rows: "All canvases", "Unfiled", then folder A, B, C in order
 * - Clicking a folder row changes the active folder filter
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { FolderTree } from "./FolderTree";
import type { Folder } from "../dashboard/useFolderList";

// dnd-kit requires pointer event support — provide minimal stubs
mock.module("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useDroppable: () => ({ isOver: false, setNodeRef: () => {} }),
  useSensor: () => ({}),
  useSensors: (...args: unknown[]) => args,
  PointerSensor: {},
  DragOverlay: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

afterEach(() => {
  cleanup();
});

const FOLDERS: Folder[] = [
  {
    id: "f-a",
    ownerId: "u1",
    name: "A",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "f-b",
    ownerId: "u1",
    name: "B",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "f-c",
    ownerId: "u1",
    name: "C",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(I18nextProvider, { i18n }, children),
    );
  };
}

describe("FolderTree", () => {
  test("renders All canvases, Unfiled, then 3 folder rows in order", async () => {
    const onSelect = mock((_folderId: string | null) => {});
    render(
      React.createElement(FolderTree, {
        folders: FOLDERS,
        activeFolderId: null,
        onSelectFolder: onSelect,
      }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.queryByText(/All canvases|所有畫布/i)).not.toBeNull();
      expect(screen.queryByText(/Unfiled|未分類/i)).not.toBeNull();
      expect(screen.queryByText("A")).not.toBeNull();
      expect(screen.queryByText("B")).not.toBeNull();
      expect(screen.queryByText("C")).not.toBeNull();
    });

    // Verify ordering: All canvases first, then Unfiled, then A, B, C
    const allItems = screen.getAllByRole("button");
    const texts = allItems.map((el) => el.textContent?.trim());
    // Filter to our known rows
    const knownRows = texts.filter(
      (t) =>
        t &&
        (t.match(/All canvases|所有畫布/) ||
          t.match(/Unfiled|未分類/) ||
          t === "A" ||
          t === "B" ||
          t === "C"),
    );
    // All canvases must appear before Unfiled, which must appear before A
    const allIdx = knownRows.findIndex((t) => t?.match(/All canvases|所有畫布/));
    const unfiledIdx = knownRows.findIndex((t) => t?.match(/Unfiled|未分類/));
    const aIdx = knownRows.findIndex((t) => t === "A");

    expect(allIdx).toBeLessThan(unfiledIdx);
    expect(unfiledIdx).toBeLessThan(aIdx);
  });

  test("clicking folder row calls onSelectFolder with folder id", async () => {
    const onSelect = mock((_folderId: string | null) => {});
    render(
      React.createElement(FolderTree, {
        folders: FOLDERS,
        activeFolderId: null,
        onSelectFolder: onSelect,
      }),
      { wrapper: makeWrapper() },
    );

    const user = userEvent.setup();

    await waitFor(async () => {
      const folderA = screen.queryByText("A");
      expect(folderA).not.toBeNull();
      if (folderA) {
        await user.click(folderA);
        expect(onSelect).toHaveBeenCalled();
      }
    });
  });

  test("clicking All canvases calls onSelectFolder with null", async () => {
    const onSelect = mock((_folderId: string | null) => {});
    render(
      React.createElement(FolderTree, {
        folders: FOLDERS,
        activeFolderId: "f-a",
        onSelectFolder: onSelect,
      }),
      { wrapper: makeWrapper() },
    );

    const user = userEvent.setup();

    await waitFor(async () => {
      const allCanvases = screen.queryByText(/All canvases|所有畫布/i);
      expect(allCanvases).not.toBeNull();
      if (allCanvases) {
        await user.click(allCanvases);
        expect(onSelect).toHaveBeenCalledWith(null);
      }
    });
  });
});
