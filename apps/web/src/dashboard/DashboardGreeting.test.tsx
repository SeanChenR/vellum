/**
 * DashboardGreeting tests — design Decision 9 / spec public-pages
 * "Greeting strip exposes search, primary CTA, and welcome line".
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { DashboardGreeting } from "./DashboardGreeting";

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => cleanup());

function renderGreeting(overrides: Partial<Parameters<typeof DashboardGreeting>[0]> = {}) {
  const props: Parameters<typeof DashboardGreeting>[0] = {
    userName: "Sean",
    searchQuery: "",
    onSearchChange: mock((_q: string) => {}),
    onCreateClick: mock(() => {}),
    ...overrides,
  };
  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <DashboardGreeting {...props} />
      </I18nextProvider>,
    ),
    props,
  };
}

describe("DashboardGreeting", () => {
  test("renders the welcome line containing user.name (zh-TW)", () => {
    renderGreeting({ userName: "Sean" });
    const heading = screen.getByTestId("dashboard-greeting-hello");
    expect(heading.textContent).toContain("Sean");
  });

  test("renders today's date formatted with Intl.DateTimeFormat zh-TW", () => {
    renderGreeting();
    const date = screen.getByTestId("dashboard-greeting-date");
    const expected = new Intl.DateTimeFormat("zh-TW", { dateStyle: "long" }).format(new Date());
    expect(date.textContent).toBe(expected);
  });

  test("renders a search input with the lucide Search icon", () => {
    renderGreeting();
    const input = screen.getByPlaceholderText(i18n.t("dashboard.searchPlaceholder"));
    expect(input).not.toBeNull();
    const icon = screen.getByTestId("dashboard-greeting-search-icon");
    expect(icon).not.toBeNull();
  });

  test("typing into the search input fires onSearchChange with the new value", () => {
    const onSearchChange = mock((_q: string) => {});
    renderGreeting({ onSearchChange });
    const input = screen.getByPlaceholderText(
      i18n.t("dashboard.searchPlaceholder"),
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "design" } });
    expect(onSearchChange).toHaveBeenCalledWith("design");
  });

  test("renders the new-canvas CTA with lucide Plus and dashboard.newCanvasCta text", () => {
    renderGreeting();
    const cta = screen.getByTestId("dashboard-greeting-new-canvas");
    expect(cta.textContent).toContain(i18n.t("dashboard.newCanvasCta"));
    expect(cta.querySelector('[data-testid="dashboard-greeting-plus-icon"]')).not.toBeNull();
  });

  test("clicking the new-canvas CTA fires onCreateClick", () => {
    const onCreateClick = mock(() => {});
    renderGreeting({ onCreateClick });
    fireEvent.click(screen.getByTestId("dashboard-greeting-new-canvas"));
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });
});
