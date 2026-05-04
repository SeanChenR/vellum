/**
 * use-shape-edit-lock tests — pure resolver behind the React hook.
 *
 * Spec: multiplayer-sync — "Custom shapes enforce a first-editor-wins
 * edit lock during multiplayer sessions".
 *
 * The hook is a thin wrapper around `resolveEditLock`, a pure function
 * over (shapeId, selfUserId, presences, nowMs). The hook subscribes to
 * tldraw's presence store; this test file exercises the pure resolver.
 */

import { describe, expect, test } from "bun:test";
import { resolveEditLock, STALE_LOCK_MS, type ShapePresence } from "./use-shape-edit-lock";

const SHAPE_ID = "shape:abc";
const SELF = "user-self";
const OTHER = "user-other";
const NOW = 1_700_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

function presence(
  overrides: Partial<ShapePresence> & Pick<ShapePresence, "userId">,
): ShapePresence {
  return {
    userName: "Bob",
    editingShapeId: null,
    lastActiveAt: NOW,
    ...overrides,
  };
}

describe("resolveEditLock — basic outcomes", () => {
  test("nobody editing → canEdit: true, lockedBy: null", () => {
    const r = resolveEditLock({ shapeId: SHAPE_ID, selfUserId: SELF, presences: [], nowMs: NOW });
    expect(r.canEdit).toBe(true);
    expect(r.lockedBy).toBeNull();
  });

  test("self is editing the shape → canEdit: true (own edit doesn't lock)", () => {
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [presence({ userId: SELF, editingShapeId: SHAPE_ID })],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(true);
    expect(r.lockedBy).toBeNull();
  });

  test("another user is editing the shape → canEdit: false + lockedBy populated", () => {
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [presence({ userId: OTHER, userName: "Bob", editingShapeId: SHAPE_ID })],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(false);
    expect(r.lockedBy).toEqual({ userId: OTHER, userName: "Bob" });
  });

  test("another user editing a DIFFERENT shape does not lock this one", () => {
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [presence({ userId: OTHER, editingShapeId: "shape:other" })],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(true);
    expect(r.lockedBy).toBeNull();
  });
});

describe("resolveEditLock — disconnect / stale lock fallback", () => {
  test("locking user has dropped from presence list → canEdit: true (lock auto-cleared)", () => {
    // Simulating disconnect: just don't include the locker in presences
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [presence({ userId: "user-other-2", editingShapeId: null })],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(true);
    expect(r.lockedBy).toBeNull();
  });

  test("locker's lastActiveAt > 5 minutes ago → lock ignored (stale fallback)", () => {
    const stale = NOW - 6 * 60 * 1000;
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [presence({ userId: OTHER, editingShapeId: SHAPE_ID, lastActiveAt: stale })],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(true);
    expect(r.lockedBy).toBeNull();
  });

  test("locker's lastActiveAt 4 minutes ago → lock still active", () => {
    const fresh = NOW - 4 * 60 * 1000;
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [presence({ userId: OTHER, editingShapeId: SHAPE_ID, lastActiveAt: fresh })],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(false);
    expect(r.lockedBy).not.toBeNull();
  });

  test("STALE_LOCK_MS equals 5 minutes", () => {
    expect(STALE_LOCK_MS).toBe(5 * 60 * 1000);
  });
});

describe("resolveEditLock — multiple editors edge cases", () => {
  test("two presences both editing the same shape (race) → first found wins", () => {
    // Defensive: tldraw shouldn't allow this in practice but the resolver
    // must still return a deterministic result.
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [
        presence({ userId: "user-a", userName: "Alice", editingShapeId: SHAPE_ID }),
        presence({ userId: "user-b", userName: "Bob", editingShapeId: SHAPE_ID }),
      ],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(false);
    expect(r.lockedBy?.userId).toBe("user-a");
  });

  test("ignores presences in the list that are us (we never lock ourselves)", () => {
    const r = resolveEditLock({
      shapeId: SHAPE_ID,
      selfUserId: SELF,
      presences: [
        presence({ userId: SELF, userName: "Me", editingShapeId: SHAPE_ID }),
        presence({ userId: OTHER, userName: "Bob", editingShapeId: "other-shape" }),
      ],
      nowMs: NOW,
    });
    expect(r.canEdit).toBe(true);
  });
});
