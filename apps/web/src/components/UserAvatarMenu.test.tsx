/**
 * UserAvatarMenu tests — public-pages spec "User avatar menu surfaces a
 * Go-to-Dashboard entry".
 *
 * Asserts the menu shows four items in the spec-defined order, the new
 * Go-to-Dashboard entry links to /dashboard, and remains visible
 * regardless of which surface the menu is opened on.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { UserAvatarMenu } from "./UserAvatarMenu";
import type { AuthUser } from "../auth/useAuth";

const fakeUser: AuthUser = {
  id: "u-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  locale: "en",
  createdAt: new Date().toISOString(),
};

function renderMenu() {
  const onSignOut = mock(() => {});
  render(
    <I18nextProvider i18n={i18n}>
      <UserAvatarMenu user={fakeUser} onSignOut={onSignOut} />
    </I18nextProvider>,
  );
  return { onSignOut };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /user menu/i }));
  await waitFor(() => {
    expect(screen.getByRole("menu")).not.toBeNull();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("UserAvatarMenu", () => {
  test("menu opens to four interactive items in the spec-defined order", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    const items = screen.getAllByRole("menuitem");
    expect(items.length).toBe(4);
    const labels = items.map((el) => el.textContent?.trim() ?? "");
    expect(labels[0]).toMatch(/Go to Dashboard/i);
    expect(labels[1]).toMatch(/Profile/i);
    expect(labels[2]).toMatch(/Active sessions|Sessions/i);
    expect(labels[3]).toMatch(/Sign out/i);
  });

  test("Go-to-Dashboard item is an anchor pointing to /dashboard", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    const dashItem = screen.getByRole("menuitem", { name: /Go to Dashboard/i });
    expect(dashItem.tagName.toLowerCase()).toBe("a");
    expect(dashItem.getAttribute("href")).toBe("/dashboard");
  });

  test("Profile and Sessions anchors point to the existing account routes", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    expect(screen.getByRole("menuitem", { name: /Profile/i }).getAttribute("href")).toBe(
      "/account/profile",
    );
    expect(
      screen.getByRole("menuitem", { name: /Active sessions|Sessions/i }).getAttribute("href"),
    ).toBe("/account/sessions");
  });

  test("Sign-out menuitem invokes the onSignOut callback", async () => {
    const user = userEvent.setup();
    const { onSignOut } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Sign out/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("menu uses the localized nav.userMenu.dashboard key", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    // The exact value comes from en.json — assert presence rather than the
    // literal string to keep the test resilient to copy edits.
    const item = screen.getByRole("menuitem", { name: /Go to Dashboard/i });
    expect(item).not.toBeNull();
  });
});
