/**
 * UserAvatarMenu tests.
 *
 * After the redesign-ui-aura-theme ingest (2026-05-13) consolidated
 * the three account sub-routes into a single `/account` tab page, the
 * avatar dropdown collapsed from 5 → 3 items: Dashboard / Settings /
 * Sign-out. "Settings" lands on `/account` which defaults to the
 * profile tab; users pick their sub-tab on the page itself.
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
  test("menu opens to three interactive items in spec-defined order", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    const items = screen.getAllByRole("menuitem");
    expect(items.length).toBe(3);
    const labels = items.map((el) => el.textContent?.trim() ?? "");
    expect(labels[0]).toMatch(/Go to Dashboard/i);
    expect(labels[1]).toMatch(/Settings/i);
    expect(labels[2]).toMatch(/Sign out/i);
  });

  test("Go-to-Dashboard item is an anchor pointing to /dashboard", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    const dashItem = screen.getByRole("menuitem", { name: /Go to Dashboard/i });
    expect(dashItem.tagName.toLowerCase()).toBe("a");
    expect(dashItem.getAttribute("href")).toBe("/dashboard");
  });

  test("Settings item is an anchor pointing to /account (default tab)", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    const settingsItem = screen.getByRole("menuitem", { name: /Settings/i });
    expect(settingsItem.tagName.toLowerCase()).toBe("a");
    expect(settingsItem.getAttribute("href")).toBe("/account");
  });

  test("Sign-out menuitem invokes the onSignOut callback", async () => {
    const user = userEvent.setup();
    const { onSignOut } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Sign out/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
