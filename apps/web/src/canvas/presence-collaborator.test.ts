/**
 * presence-collaborator.test.ts — verifies the sync-layer presence record
 * → CollaboratorPresence mapping.
 *
 * Spec ref: openspec/specs/ai-side-panel/spec.md
 *   "Cursor AI Badge surfaces aiActive presence flag"
 *
 * Why this exists: cursor-ai-badge writes `meta.aiActive` onto the local
 * TLInstancePresence record. tldraw sync broadcasts presence records (but
 * NOT TLInstance) so remote tabs receive the full record including `meta`.
 * This helper extracts `aiActive` out of that record into the
 * TopBar-facing CollaboratorPresence shape.
 */

import { describe, expect, test } from "bun:test";
import { mapPresenceToCollaborator, type SyncPresenceRecord } from "./presence-collaborator";

function makePresence(overrides: Partial<SyncPresenceRecord> = {}): SyncPresenceRecord {
  return {
    id: "instance_presence:user-A",
    typeName: "instance_presence",
    userId: "user-A",
    userName: "Alice",
    meta: {},
    ...overrides,
  };
}

describe("mapPresenceToCollaborator", () => {
  test("aiActive=true when presence.meta.aiActive is the boolean true", () => {
    const out = mapPresenceToCollaborator(
      makePresence({ meta: { aiActive: true } }),
      "https://example.com/avatar.png",
    );
    expect(out.aiActive).toBe(true);
  });

  test("aiActive=false when presence.meta.aiActive is false", () => {
    const out = mapPresenceToCollaborator(makePresence({ meta: { aiActive: false } }), null);
    expect(out.aiActive).toBe(false);
  });

  test("aiActive=false when meta.aiActive is missing", () => {
    const out = mapPresenceToCollaborator(makePresence({ meta: {} }), null);
    expect(out.aiActive).toBe(false);
  });

  test("aiActive=false when meta itself is missing", () => {
    const r = makePresence();
    delete r.meta;
    const out = mapPresenceToCollaborator(r, null);
    expect(out.aiActive).toBe(false);
  });

  test("aiActive=false when meta.aiActive is a truthy non-boolean (defensive)", () => {
    const out = mapPresenceToCollaborator(
      makePresence({ meta: { aiActive: "yes" as unknown as boolean } }),
      null,
    );
    expect(out.aiActive).toBe(false);
  });

  test("forwards userId / userName / image into the collaborator row", () => {
    const out = mapPresenceToCollaborator(
      makePresence({ userId: "u-9", userName: "Bob" }),
      "https://cdn/avatar/bob.png",
    );
    expect(out).toEqual({
      userId: "u-9",
      name: "Bob",
      image: "https://cdn/avatar/bob.png",
      aiActive: false,
    });
  });
});
