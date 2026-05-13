/**
 * list-canvases-reader.test.ts — internal reader used by the MCP server's
 * `listCanvases` tool. Returns the canvases a user can access:
 * owned + shared (editor / viewer), each row carrying the user's role on it.
 *
 * Spec ref: openspec/specs/server-mutation-bridge/spec.md
 *   "Tool registry enumerates the full agent tool surface" (listCanvases entry)
 *
 * Test pattern follows mutator-readers.test.ts — fake the db query
 * surface rather than touching Postgres.
 */

import { describe, expect, test } from "bun:test";
import { listCanvasesForUser, type ListCanvasesDeps } from "./list-canvases-reader";

interface FakeCanvasRow {
  id: string;
  title: string;
  ownerId: string;
}

interface FakeShareRow {
  canvasId: string;
  userId: string;
  role: "editor" | "viewer";
}

function buildFakeDeps(opts: {
  canvases?: FakeCanvasRow[];
  shares?: FakeShareRow[];
  throwOnQuery?: boolean;
}): ListCanvasesDeps {
  const canvasesData = opts.canvases ?? [];
  const sharesData = opts.shares ?? [];
  return {
    queryOwnedCanvases: async (userId) => {
      if (opts.throwOnQuery) throw new Error("boom");
      return canvasesData.filter((c) => c.ownerId === userId);
    },
    querySharedCanvases: async (userId) => {
      if (opts.throwOnQuery) throw new Error("boom");
      const userShares = sharesData.filter((s) => s.userId === userId);
      return userShares.map((s) => {
        const canvas = canvasesData.find((c) => c.id === s.canvasId);
        if (!canvas) throw new Error(`canvas ${s.canvasId} missing in fixture`);
        return { id: canvas.id, title: canvas.title, role: s.role };
      });
    },
  };
}

describe("listCanvasesForUser", () => {
  test("returns empty array when user owns nothing and has no shares", async () => {
    const result = await listCanvasesForUser(buildFakeDeps({}), "user-A");
    expect(result).toEqual({ ok: true, data: [] });
  });

  test("returns owned canvases with role 'owner'", async () => {
    const deps = buildFakeDeps({
      canvases: [
        { id: "c1", title: "Project Alpha", ownerId: "user-A" },
        { id: "c2", title: "Project Beta", ownerId: "user-A" },
      ],
    });
    const result = await listCanvasesForUser(deps, "user-A");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((r) => r.role === "owner")).toBe(true);
      expect(result.data.map((r) => r.id).sort()).toEqual(["c1", "c2"]);
    }
  });

  test("returns shared canvases with their assigned role", async () => {
    const deps = buildFakeDeps({
      canvases: [
        { id: "c1", title: "Editable", ownerId: "other" },
        { id: "c2", title: "Viewable", ownerId: "other" },
      ],
      shares: [
        { canvasId: "c1", userId: "user-A", role: "editor" },
        { canvasId: "c2", userId: "user-A", role: "viewer" },
      ],
    });
    const result = await listCanvasesForUser(deps, "user-A");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const byId = new Map(result.data.map((r) => [r.id, r]));
      expect(byId.get("c1")?.role).toBe("editor");
      expect(byId.get("c2")?.role).toBe("viewer");
    }
  });

  test("combines owned and shared canvases, no duplicates", async () => {
    const deps = buildFakeDeps({
      canvases: [
        { id: "c1", title: "Owned", ownerId: "user-A" },
        { id: "c2", title: "Shared", ownerId: "other" },
      ],
      shares: [{ canvasId: "c2", userId: "user-A", role: "viewer" }],
    });
    const result = await listCanvasesForUser(deps, "user-A");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      const byId = new Map(result.data.map((r) => [r.id, r]));
      expect(byId.get("c1")?.role).toBe("owner");
      expect(byId.get("c2")?.role).toBe("viewer");
    }
  });

  test("excludes canvases the user has no relationship to", async () => {
    const deps = buildFakeDeps({
      canvases: [
        { id: "c1", title: "A's", ownerId: "user-A" },
        { id: "c2", title: "Other's", ownerId: "user-B" },
      ],
      shares: [],
    });
    const result = await listCanvasesForUser(deps, "user-A");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe("c1");
    }
  });

  test("returns each entry with id, title, role fields and nothing else (no snapshot etc.)", async () => {
    const deps = buildFakeDeps({
      canvases: [{ id: "c1", title: "T", ownerId: "user-A" }],
    });
    const result = await listCanvasesForUser(deps, "user-A");
    if (!result.ok) throw new Error("expected ok");
    const entry = result.data[0]!;
    expect(Object.keys(entry).sort()).toEqual(["id", "role", "title"]);
  });

  test("caps the response at 100 entries to bound payload size", async () => {
    // Owner has 150 canvases — return only the first 100.
    const canvases: FakeCanvasRow[] = Array.from({ length: 150 }, (_, i) => ({
      id: `c${i}`,
      title: `Canvas ${i}`,
      ownerId: "user-A",
    }));
    const deps = buildFakeDeps({ canvases });
    const result = await listCanvasesForUser(deps, "user-A");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(100);
    }
  });
});
