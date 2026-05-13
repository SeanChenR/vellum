/**
 * ThemeToggle.test.tsx — navbar theme toggle contract.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Theme toggle is reachable from the navbar"
 *   scenarios: "Cycling through modes", "Toggle has accessible label"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../i18n";
import { useUIStore } from "../store/uiStore";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ themeMode: "system" });
    void i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("renders Monitor icon when in system mode", () => {
    render(<ThemeToggle />);
    expect(screen.getByTestId("theme-toggle-icon-system")).toBeDefined();
  });

  test("clicking once cycles system → light and shows Sun icon", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /Switch theme/i }));
    expect(useUIStore.getState().themeMode).toBe("light");
    expect(screen.getByTestId("theme-toggle-icon-light")).toBeDefined();
  });

  test("three clicks cycle back to system", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /Switch theme/i });
    await user.click(btn); // system → light
    await user.click(btn); // light → dark
    await user.click(btn); // dark → system
    expect(useUIStore.getState().themeMode).toBe("system");
    expect(screen.getByTestId("theme-toggle-icon-system")).toBeDefined();
  });

  test("aria-label reflects the current mode using nav.theme.toggleAriaLabel", async () => {
    useUIStore.setState({ themeMode: "dark" });
    render(<ThemeToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(
      /Switch theme.*current.*Dark/i,
    );
  });
});
