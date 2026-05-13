/**
 * theme-provider.test.tsx — verifies `<ThemeProvider>` syncs the
 * effective theme to `<html data-theme="...">` on mount and on every
 * change.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Theme tokens are CSS custom properties switched by data-theme"
 *   scenario: "A primitive renders both themes from the same JSX"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { useUIStore } from "../store/uiStore";
import { ThemeProvider } from "./theme-provider";

describe("ThemeProvider", () => {
  let originalTheme: string | null;

  beforeEach(() => {
    originalTheme = document.documentElement.getAttribute("data-theme");
    localStorage.clear();
    useUIStore.setState({ themeMode: "system" });
  });

  afterEach(() => {
    cleanup();
    if (originalTheme === null) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", originalTheme);
    }
    localStorage.clear();
  });

  test("on mount, sets data-theme to the effective theme", () => {
    useUIStore.setState({ themeMode: "dark" });
    render(<ThemeProvider>child</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("updates data-theme when themeMode changes", () => {
    useUIStore.setState({ themeMode: "light" });
    render(<ThemeProvider>child</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    act(() => {
      useUIStore.getState().setThemeMode("dark");
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("renders children unchanged", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );
    expect(getByTestId("child").textContent).toBe("hello");
  });
});
