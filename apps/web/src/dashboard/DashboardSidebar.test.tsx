/**
 * DashboardSidebar tests — design Decision 9 / spec public-pages
 * "Sidebar folder active state uses accent-purple-soft".
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { DashboardSidebar } from "./DashboardSidebar";

const FOLDERS = [
  {
    id: "f-1",
    ownerId: "u-1",
    name: "Sketches",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "f-2",
    ownerId: "u-1",
    name: "Inbox",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  },
];

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => cleanup());

function renderSidebar(overrides: Partial<Parameters<typeof DashboardSidebar>[0]> = {}) {
  const props: Parameters<typeof DashboardSidebar>[0] = {
    folders: FOLDERS,
    activeFolderId: "f-1",
    onSelectFolder: mock(() => {}),
    onCreateFolder: mock(() => {}),
    tags: ["設計", "Phase 2"],
    ...overrides,
  };
  return render(
    <DndContext>
      <I18nextProvider i18n={i18n}>
        <DashboardSidebar {...props} />
      </I18nextProvider>
    </DndContext>,
  );
}

describe("DashboardSidebar", () => {
  test("renders FolderTree in vertical orientation", () => {
    renderSidebar();
    const tabs = document.querySelectorAll('[data-orientation="vertical"]');
    expect(tabs.length).toBeGreaterThanOrEqual(5); // 3 sentinels + 2 user folders
  });

  test("active folder row uses accent-purple/10 background + accent-purple text", () => {
    renderSidebar({ activeFolderId: "f-1" });
    const tabs = document.querySelectorAll('[data-orientation="vertical"]');
    const activeTab = Array.from(tabs).find((el) => el.getAttribute("data-active") === "true");
    expect(activeTab).not.toBeUndefined();
    const button = activeTab!.querySelector("button");
    expect(button!.className).toContain("bg-accent-purple/10");
    expect(button!.className).toContain("text-accent-purple");
  });

  test("renders tag chips using the Badge primitive", () => {
    renderSidebar({ tags: ["設計", "Phase 2"] });
    const chips = document.querySelectorAll('[data-testid="dashboard-sidebar-tag"]');
    expect(chips).toHaveLength(2);
    chips.forEach((c) => {
      expect(c.getAttribute("data-tone")).toBeTruthy();
    });
  });

  test("does NOT render the sort buttons (moved to the canvas section header)", () => {
    renderSidebar();
    expect(screen.queryByTestId("sort-btn-recent")).toBeNull();
    expect(screen.queryByTestId("sort-btn-alphabetical")).toBeNull();
  });

  test("clicking a folder row fires onSelectFolder with the folder id", () => {
    const onSelectFolder = mock((_id: string | null) => {});
    renderSidebar({ onSelectFolder });
    const tabs = document.querySelectorAll('[data-orientation="vertical"]');
    // First tab is "all" sentinel → onSelectFolder(null)
    const button = (tabs[0]! as HTMLElement).querySelector("button")!;
    fireEvent.click(button);
    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });
});
