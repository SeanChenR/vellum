/**
 * Permission contract for canvas actions.
 *
 * Tests the `canAccess(user, canvas, action)` deep module.
 *
 * Phase 1 rule: owner (user.id === canvas.ownerId) gets true for all actions;
 * non-owner and anonymous always get false.
 *
 * Spec: "Permission contract for canvas actions"
 */

import { describe, expect, test } from "bun:test";
import { canAccess } from "./permission";
import type { CanvasAction } from "./permission";

// Minimal shapes for testing — we only need the fields canAccess uses.
const OWNER_ID = "user-abc";
const OTHER_ID = "user-xyz";

const mockCanvas = {
  id: "canvas-1",
  ownerId: OWNER_ID,
  folderId: null,
  title: "Test Canvas",
  snapshot: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const owner = { id: OWNER_ID };
const nonOwner = { id: OTHER_ID };

const ALL_ACTIONS: CanvasAction[] = ["read", "write", "delete", "share"];

describe("canAccess — phase 1 owner-only rule (no ctx)", () => {
  describe("owner check returns true for all actions", () => {
    for (const action of ALL_ACTIONS) {
      test(`owner can ${action}`, () => {
        expect(canAccess(owner, mockCanvas, action)).toBe(true);
      });
    }
  });

  describe("non-owner check returns false for all actions", () => {
    for (const action of ALL_ACTIONS) {
      test(`non-owner cannot ${action}`, () => {
        expect(canAccess(nonOwner, mockCanvas, action)).toBe(false);
      });
    }
  });

  describe("anonymous user check returns false for all actions", () => {
    for (const action of ALL_ACTIONS) {
      test(`anonymous cannot ${action}`, () => {
        expect(canAccess(null, mockCanvas, action)).toBe(false);
      });
    }
  });

  test("returns false for undefined user", () => {
    expect(canAccess(undefined, mockCanvas, "read")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sharing extension — `canAccess(user, canvas, action, ctx?)` with shared
// roles + public-link mode, per the canvas-management MODIFIED spec
// requirement "Permission contract for canvas actions".
// ---------------------------------------------------------------------------

interface MatrixRow {
  user: { id: string } | null;
  sharedRole: "editor" | "viewer" | null;
  publicLinkMode: "closed" | "view" | "edit" | null;
  expected: { read: boolean; write: boolean; delete: boolean; share: boolean };
}

const MATRIX: ReadonlyArray<readonly [string, MatrixRow]> = [
  [
    "owner without ctx",
    {
      user: owner,
      sharedRole: null,
      publicLinkMode: null,
      expected: { read: true, write: true, delete: true, share: true },
    },
  ],
  [
    "shared editor (non-owner)",
    {
      user: nonOwner,
      sharedRole: "editor",
      publicLinkMode: null,
      expected: { read: true, write: true, delete: false, share: false },
    },
  ],
  [
    "shared viewer (non-owner)",
    {
      user: nonOwner,
      sharedRole: "viewer",
      publicLinkMode: null,
      expected: { read: true, write: false, delete: false, share: false },
    },
  ],
  [
    "anonymous via public-link-edit",
    {
      user: null,
      sharedRole: null,
      publicLinkMode: "edit",
      expected: { read: true, write: true, delete: false, share: false },
    },
  ],
  [
    "anonymous via public-link-view",
    {
      user: null,
      sharedRole: null,
      publicLinkMode: "view",
      expected: { read: true, write: false, delete: false, share: false },
    },
  ],
  [
    "anonymous via closed public link",
    {
      user: null,
      sharedRole: null,
      publicLinkMode: "closed",
      expected: { read: false, write: false, delete: false, share: false },
    },
  ],
  [
    "anonymous without any context",
    {
      user: null,
      sharedRole: null,
      publicLinkMode: null,
      expected: { read: false, write: false, delete: false, share: false },
    },
  ],
];

describe("canAccess — sharing extension matrix", () => {
  for (const [label, row] of MATRIX) {
    describe(label, () => {
      for (const action of ALL_ACTIONS) {
        const expected = row.expected[action];
        test(`${action} → ${expected}`, () => {
          expect(
            canAccess(row.user, mockCanvas, action, {
              sharedRole: row.sharedRole,
              publicLinkMode: row.publicLinkMode,
            }),
          ).toBe(expected);
        });
      }
    });
  }

  test("a logged-in user who is also the owner ignores sharedRole=viewer downgrade attempt", () => {
    // Defensive: even if ctx claims a viewer share, ownership wins.
    expect(
      canAccess(owner, mockCanvas, "delete", { sharedRole: "viewer", publicLinkMode: null }),
    ).toBe(true);
  });

  test("a logged-in user with both sharedRole and publicLinkMode uses sharedRole as the strongest fact", () => {
    // Logged-in shared editor visiting via a closed link still has editor access.
    expect(
      canAccess(nonOwner, mockCanvas, "write", {
        sharedRole: "editor",
        publicLinkMode: "closed",
      }),
    ).toBe(true);
  });
});
