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

describe("canAccess — phase 1 owner-only rule", () => {
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
