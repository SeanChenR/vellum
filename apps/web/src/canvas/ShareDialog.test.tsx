/**
 * ShareDialog tests (task 4.1).
 *
 * Spec: sharing — "ShareDialog opens from the TopBar Share button"
 *
 * Three sections:
 *   1. Invite by email — input + role select + send button → POST invite
 *   2. Members — owner row + share rows + pending invite rows;
 *      role-select PATCH, remove-button DELETE, revoke-invite DELETE
 *   3. Public link — radio (closed/view/edit) → PUT, copy button, rotate
 *
 * Data is sourced from `useShareState` which is mocked here so the dialog
 * tests stay focused on UI wiring.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";

// ---------------------------------------------------------------------------
// Mocks — useShareState
// ---------------------------------------------------------------------------

interface MockMutations {
  invite: { mutate: ReturnType<typeof mock>; isPending: boolean };
  patchRole: { mutate: ReturnType<typeof mock>; isPending: boolean };
  removeMember: { mutate: ReturnType<typeof mock>; isPending: boolean };
  revokeInvite: { mutate: ReturnType<typeof mock>; isPending: boolean };
  setLinkMode: { mutate: ReturnType<typeof mock>; isPending: boolean };
  rotateLink: { mutate: ReturnType<typeof mock>; isPending: boolean };
}

function makeMutations(): MockMutations {
  return {
    invite: { mutate: mock(() => {}), isPending: false },
    patchRole: { mutate: mock(() => {}), isPending: false },
    removeMember: { mutate: mock(() => {}), isPending: false },
    revokeInvite: { mutate: mock(() => {}), isPending: false },
    setLinkMode: { mutate: mock(() => {}), isPending: false },
    rotateLink: { mutate: mock(() => {}), isPending: false },
  };
}

interface MockState {
  data: {
    ownerId: string;
    members: Array<{
      userId: string;
      role: "editor" | "viewer";
      user: { id: string; email: string; name: string } | null;
      createdAt: string;
    }>;
    invites: Array<{ id: string; email: string; role: "editor" | "viewer"; expiresAt: string }>;
    link: { canvasId: string; token: string; mode: "closed" | "view" | "edit" } | null;
  } | null;
  isLoading: boolean;
}

let mockState: MockState = { data: null, isLoading: false };
let mockMutations: MockMutations = makeMutations();

mock.module("./useShareState", () => ({
  useShareState: () => ({
    ...mockState,
    ...mockMutations,
  }),
}));

const { ShareDialog } = await import("./ShareDialog");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockMutations = makeMutations();
  mockState = {
    data: {
      ownerId: "u-owner",
      members: [],
      invites: [],
      link: null,
    },
    isLoading: false,
  };
});

afterEach(() => {
  cleanup();
});

function renderDialog() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ShareDialog open canvasId="c1" onClose={() => {}} />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShareDialog — three sections", () => {
  test("renders Invite, Members, and Public link sections", () => {
    renderDialog();
    expect(screen.queryByText(/invite by email/i)).not.toBeNull();
    expect(screen.queryByText(/members/i)).not.toBeNull();
    expect(screen.queryByText(/public link/i)).not.toBeNull();
  });
});

describe("ShareDialog — invite section", () => {
  test("submitting the invite form calls invite mutation with email + role", async () => {
    const user = userEvent.setup();
    renderDialog();
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    await user.type(emailInput, "alice@example.com");
    const sendBtn = screen.getByRole("button", { name: /send invite/i });
    await user.click(sendBtn);
    expect(mockMutations.invite.mutate).toHaveBeenCalledTimes(1);
    const args = mockMutations.invite.mutate.mock.calls[0]?.[0] as { email: string; role: string };
    expect(args.email).toBe("alice@example.com");
    expect(args.role).toBe("editor");
  });
});

describe("ShareDialog — members section", () => {
  test("changing a member's role select calls patchRole mutation", async () => {
    mockState.data!.members = [
      {
        userId: "u-bob",
        role: "editor",
        user: { id: "u-bob", email: "bob@x.com", name: "Bob" },
        createdAt: new Date().toISOString(),
      },
    ];
    renderDialog();
    const select = screen.getByLabelText(/bob/i, { selector: "select" }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "viewer" } });
    expect(mockMutations.patchRole.mutate).toHaveBeenCalledTimes(1);
    const args = mockMutations.patchRole.mutate.mock.calls[0]?.[0] as {
      userId: string;
      role: string;
    };
    expect(args.userId).toBe("u-bob");
    expect(args.role).toBe("viewer");
  });

  test("clicking remove on a member calls removeMember mutation", async () => {
    mockState.data!.members = [
      {
        userId: "u-bob",
        role: "viewer",
        user: { id: "u-bob", email: "bob@x.com", name: "Bob" },
        createdAt: new Date().toISOString(),
      },
    ];
    const user = userEvent.setup();
    renderDialog();
    const removeBtn = screen.getByRole("button", { name: /remove.*bob/i });
    await user.click(removeBtn);
    expect(mockMutations.removeMember.mutate).toHaveBeenCalledTimes(1);
  });

  test("pending invites show with a Pending badge and revoke button", async () => {
    mockState.data!.invites = [
      {
        id: "inv-1",
        email: "alice@x.com",
        role: "viewer",
        expiresAt: "2030-01-01T00:00:00Z",
      },
    ];
    const user = userEvent.setup();
    renderDialog();
    expect(screen.queryByText(/pending/i)).not.toBeNull();
    expect(screen.queryByText(/alice@x\.com/)).not.toBeNull();
    const revokeBtn = screen.getByRole("button", { name: /remove.*alice/i });
    await user.click(revokeBtn);
    expect(mockMutations.revokeInvite.mutate).toHaveBeenCalledTimes(1);
  });
});

describe("ShareDialog — public link section", () => {
  test("changing mode to view calls setLinkMode", async () => {
    const user = userEvent.setup();
    renderDialog();
    const viewRadio = screen.getByRole("radio", { name: /view only/i });
    await user.click(viewRadio);
    expect(mockMutations.setLinkMode.mutate).toHaveBeenCalledTimes(1);
    const args = mockMutations.setLinkMode.mutate.mock.calls[0]?.[0] as { mode: string };
    expect(args.mode).toBe("view");
  });

  test("rotate button calls rotateLink mutation", async () => {
    mockState.data!.link = { canvasId: "c1", token: "abc", mode: "view" };
    const user = userEvent.setup();
    renderDialog();
    const rotateBtn = screen.getByRole("button", { name: /rotate/i });
    await user.click(rotateBtn);
    expect(mockMutations.rotateLink.mutate).toHaveBeenCalledTimes(1);
  });

  test("copy button is rendered and enabled when link mode is open", () => {
    // navigator.clipboard write-back behaviour is tested manually in 6.5
    // (happy-dom's clipboard accessor is finicky to override). Here we
    // assert the button is exposed and enabled in the right state.
    mockState.data!.link = { canvasId: "c1", token: "tok-abc", mode: "view" };
    renderDialog();
    const copyBtn = screen.getByRole("button", { name: /copy/i }) as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(false);
  });

  test("copy button is disabled when link mode is closed", () => {
    mockState.data!.link = { canvasId: "c1", token: "tok-abc", mode: "closed" };
    renderDialog();
    const copyBtn = screen.getByRole("button", { name: /copy/i }) as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(true);
  });
});
