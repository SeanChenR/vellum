/**
 * SortToggle tests — segmented sort control hoisted out of the sidebar
 * into the canvas section header.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { SortToggle } from "./SortToggle";
import type { SortOrder } from "./useSortOrder";

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => cleanup());

function renderToggle(value: SortOrder, onChange: (next: SortOrder) => void = mock(() => {})) {
  return render(
    <I18nextProvider i18n={i18n}>
      <SortToggle value={value} onChange={onChange} />
    </I18nextProvider>,
  );
}

describe("SortToggle", () => {
  test("renders two buttons: recent + alphabetical", () => {
    renderToggle("recent");
    expect(screen.getByTestId("sort-btn-recent")).not.toBeNull();
    expect(screen.getByTestId("sort-btn-alphabetical")).not.toBeNull();
  });

  test("active button carries aria-pressed=true; inactive aria-pressed=false", () => {
    renderToggle("recent");
    expect(screen.getByTestId("sort-btn-recent").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("sort-btn-alphabetical").getAttribute("aria-pressed")).toBe("false");
  });

  test("active button uses bg-surface-elevated + text-text-primary; inactive uses text-text-muted", () => {
    renderToggle("alphabetical");
    const recent = screen.getByTestId("sort-btn-recent");
    const alpha = screen.getByTestId("sort-btn-alphabetical");
    expect(alpha.className).toContain("bg-surface-elevated");
    expect(alpha.className).toContain("text-text-primary");
    expect(recent.className).toContain("text-text-muted");
  });

  test("clicking alphabetical fires onChange('alphabetical')", () => {
    const onChange = mock((_o: SortOrder) => {});
    renderToggle("recent", onChange);
    fireEvent.click(screen.getByTestId("sort-btn-alphabetical"));
    expect(onChange).toHaveBeenCalledWith("alphabetical");
  });

  test("group has role='group' with the localized aria-label", () => {
    renderToggle("recent");
    const group = screen.getByTestId("dashboard-sort-toggle");
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe(i18n.t("dashboard.sidebar.sortHeading"));
  });
});
