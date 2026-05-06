/**
 * tool-registry.test.ts — assertions for the tool-registry lookup table.
 *
 * Spec ref: openspec/changes/add-full-tool-surface/specs/server-mutation-bridge/spec.md
 *   "Tool registry enumerates the full agent tool surface"
 */

import { describe, expect, mock, test } from "bun:test";
import { toolRegistry } from "./tool-registry";

describe("toolRegistry — composition", () => {
  test("contains exactly eleven entries", () => {
    expect(Object.keys(toolRegistry).length).toBe(11);
  });

  test("has exactly six write entries and five read entries", () => {
    const all = Object.values(toolRegistry);
    const writes = all.filter((e) => e.kind === "write");
    const reads = all.filter((e) => e.kind === "read");
    expect(writes).toHaveLength(6);
    expect(reads).toHaveLength(5);
  });

  test("every entry has a non-empty name, a Zod schema, and a callable execute", () => {
    for (const entry of Object.values(toolRegistry)) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.execute).toBe("function");
      expect(entry.schema).toBeDefined();
      // Zod schemas have a parse function.
      expect(typeof (entry.schema as { parse: unknown }).parse).toBe("function");
    }
  });

  test("all eleven expected tool names are present", () => {
    const expected = [
      "createShape",
      "updateShape",
      "deleteShape",
      "groupShapes",
      "ungroupShape",
      "connectShapes",
      "listShapesInViewport",
      "listShapesInSelection",
      "getShape",
      "getCanvasBounds",
      "getViewport",
    ].sort();
    const actual = Object.keys(toolRegistry).sort();
    expect(actual).toEqual(expected);
  });
});

describe("toolRegistry — write entry routes through applyMutation", () => {
  test("createShape entry calls applyMutation with a single-element array", async () => {
    // Polymorphic execute — narrow to the createShape variant so the
    // payload literal type-checks.
    const entry = toolRegistry["createShape"] as unknown as {
      kind: "write";
      execute(
        deps: unknown,
        canvasId: string,
        input: { id: string; type: string; x: number; y: number },
      ): Promise<{ ok: true; appliedCount: number } | { ok: false; errorKey: string }>;
    };
    expect(entry.kind).toBe("write");

    // Inject a mock applyMutation via deps so we can spy without hitting
    // the real registry.
    const fakeApply = mock(async () => ({ ok: true, appliedCount: 1 }));
    const deps = {
      registry: { getRoom: () => undefined },
      applyMutation: fakeApply as never,
    };

    const result = await entry.execute(deps, "canvas-1", {
      id: "shape:abc",
      type: "geo",
      x: 0,
      y: 0,
    });

    expect(fakeApply).toHaveBeenCalledTimes(1);
    // applyMutation(deps, canvasId, mutations[])
    const call = fakeApply.mock.calls[0] as unknown as [unknown, string, unknown[]];
    expect(call[1]).toBe("canvas-1");
    expect(Array.isArray(call[2])).toBe(true);
    expect(call[2][0]).toEqual({
      type: "createShape",
      payload: { id: "shape:abc", type: "geo", x: 0, y: 0 },
    });
    expect(result).toEqual({ ok: true, appliedCount: 1 });
  });
});

describe("toolRegistry — read entry routes through corresponding reader", () => {
  test("getShape entry calls getShape reader and returns its result", async () => {
    // The registry's union type makes execute polymorphic — cast to
    // the specific read entry signature when invoking with a payload
    // shape that's not common to every variant.
    const entry = toolRegistry["getShape"] as unknown as {
      kind: "read";
      execute(
        deps: unknown,
        canvasId: string,
        input: { shapeId: string },
      ): Promise<{ ok: true; data: { id: string } | null } | { ok: false; errorKey: string }>;
    };
    expect(entry.kind).toBe("read");

    const fakeRoom = {
      getCurrentSnapshot: () => ({
        documents: [
          {
            state: {
              id: "shape:abc",
              typeName: "shape",
              type: "geo",
              x: 1,
              y: 2,
              parentId: "page:page",
              rotation: 0,
              meta: {},
              props: {},
            },
          },
        ],
      }),
      getPresenceRecords: () => ({}),
    };
    const deps = {
      registry: {
        getRoom: () => fakeRoom,
      },
    };

    const result = await entry.execute(deps, "canvas-1", { shapeId: "shape:abc" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.id).toBe("shape:abc");
    }
  });
});
