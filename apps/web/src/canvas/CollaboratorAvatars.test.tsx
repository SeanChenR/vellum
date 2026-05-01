/**
 * CollaboratorAvatars tests (task 4.3).
 *
 * Covers spec requirement:
 *   "TopBar displays the current collaborator avatar list"
 *
 * The list source is whatever the parent passes — typically the result of
 * subscribing to tldraw sync's awareness records. Tests pass synthetic
 * presence rows so we exercise the rendering rules in isolation.
 */

import "../i18n";
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { CollaboratorAvatars, type CollaboratorPresence } from "./CollaboratorAvatars";

afterEach(() => {
  cleanup();
});

const LOCAL_USER_ID = "u-local";

function makePresence(id: string, name = `User ${id}`): CollaboratorPresence {
  return {
    userId: id,
    name,
    image: null,
  };
}

function renderWith(remote: CollaboratorPresence[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CollaboratorAvatars localUserId={LOCAL_USER_ID} collaborators={remote} />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Rendering rules — count + overflow
// ---------------------------------------------------------------------------

describe("avatar count by collaborator population", () => {
  test("0 remote collaborators renders zero avatars and no overflow badge", () => {
    renderWith([]);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(0);
    expect(screen.queryByTestId("collaborator-overflow")).toBeNull();
  });

  test("1 remote collaborator renders one avatar", () => {
    renderWith([makePresence("u-1")]);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(1);
    expect(screen.queryByTestId("collaborator-overflow")).toBeNull();
  });

  test("4 remote collaborators render four avatars without overflow", () => {
    renderWith([
      makePresence("u-1"),
      makePresence("u-2"),
      makePresence("u-3"),
      makePresence("u-4"),
    ]);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(4);
    expect(screen.queryByTestId("collaborator-overflow")).toBeNull();
  });

  test("5 remote collaborators render four avatars + overflow `+1`", () => {
    renderWith([
      makePresence("u-1"),
      makePresence("u-2"),
      makePresence("u-3"),
      makePresence("u-4"),
      makePresence("u-5"),
    ]);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(4);
    const overflow = screen.getByTestId("collaborator-overflow");
    expect(overflow.textContent).toContain("+1");
  });

  test("12 remote collaborators render four avatars + overflow `+8`", () => {
    const remote = Array.from({ length: 12 }, (_, i) => makePresence(`u-${i}`));
    renderWith(remote);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(4);
    expect(screen.getByTestId("collaborator-overflow").textContent).toContain("+8");
  });
});

// ---------------------------------------------------------------------------
// Local user exclusion
// ---------------------------------------------------------------------------

describe("local user exclusion", () => {
  test("local user MUST NOT appear in the avatar list", () => {
    renderWith([makePresence(LOCAL_USER_ID, "Me"), makePresence("u-1", "Alice")]);
    const avatars = screen.queryAllByTestId("collaborator-avatar");
    expect(avatars).toHaveLength(1);
    // Avatar's title/aria-label SHOULD reference the remote user.
    expect(avatars[0]?.getAttribute("aria-label")).toContain("Alice");
  });

  test("local user as the only entry renders zero avatars", () => {
    renderWith([makePresence(LOCAL_USER_ID, "Me")]);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reactive updates
// ---------------------------------------------------------------------------

describe("presence updates reflect on the next render", () => {
  test("re-rendering with a different list updates the avatars", () => {
    const { rerender } = renderWith([makePresence("u-1")]);
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(1);

    rerender(
      <I18nextProvider i18n={i18n}>
        <CollaboratorAvatars
          localUserId={LOCAL_USER_ID}
          collaborators={[makePresence("u-1"), makePresence("u-2")]}
        />
      </I18nextProvider>,
    );
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(2);

    rerender(
      <I18nextProvider i18n={i18n}>
        <CollaboratorAvatars localUserId={LOCAL_USER_ID} collaborators={[]} />
      </I18nextProvider>,
    );
    expect(screen.queryAllByTestId("collaborator-avatar")).toHaveLength(0);
  });
});
