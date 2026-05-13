/**
 * Tabs primitive tests — design Decision 10 / spec account ADDED
 * Requirement "Account settings live under a single tabbed route".
 *
 * Asserts WAI-ARIA tabs pattern + active state visual class.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "./Tabs";

afterEach(() => cleanup());

const ITEMS = [
  { id: "profile", label: "個人資料" },
  { id: "sessions", label: "登入裝置" },
  { id: "api-keys", label: "API 與 MCP" },
  { id: "pricing", label: "定價參考" },
];

describe("Tabs", () => {
  test("renders role='tablist' with one role='tab' per item", () => {
    render(<Tabs items={ITEMS} activeId="profile" onChange={mock(() => {})} />);
    expect(screen.getByRole("tablist")).not.toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  test("each tab has aria-selected matching activeId and aria-controls referencing a panel id", () => {
    render(<Tabs items={ITEMS} activeId="api-keys" onChange={mock(() => {})} />);
    const tabs = screen.getAllByRole("tab");
    const apiKeysTab = tabs.find((t) => t.textContent === "API 與 MCP")!;
    expect(apiKeysTab.getAttribute("aria-selected")).toBe("true");
    expect(apiKeysTab.getAttribute("aria-controls")).toBe("tabpanel-api-keys");

    const profileTab = tabs.find((t) => t.textContent === "個人資料")!;
    expect(profileTab.getAttribute("aria-selected")).toBe("false");
    expect(profileTab.getAttribute("aria-controls")).toBe("tabpanel-profile");
  });

  test("active tab carries the accent-purple underline class", () => {
    render(<Tabs items={ITEMS} activeId="profile" onChange={mock(() => {})} />);
    const tabs = screen.getAllByRole("tab");
    const active = tabs.find((t) => t.textContent === "個人資料")!;
    expect(active.className).toContain("border-accent-purple");
    expect(active.className).toContain("text-text-primary");

    const inactive = tabs.find((t) => t.textContent === "登入裝置")!;
    expect(inactive.className).toContain("text-text-muted");
    expect(inactive.className).not.toContain("border-accent-purple");
  });

  test("clicking a tab fires onChange with that id", () => {
    const onChange = mock((_id: string) => {});
    render(<Tabs items={ITEMS} activeId="profile" onChange={onChange} />);
    const sessions = screen.getAllByRole("tab").find((t) => t.textContent === "登入裝置")!;
    fireEvent.click(sessions);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("sessions");
  });

  test("tablist container uses flex border-b for layout", () => {
    const { container } = render(
      <Tabs items={ITEMS} activeId="profile" onChange={mock(() => {})} />,
    );
    const tablist = container.querySelector('[role="tablist"]')!;
    expect(tablist.className).toContain("flex");
    expect(tablist.className).toContain("border-b");
  });
});
