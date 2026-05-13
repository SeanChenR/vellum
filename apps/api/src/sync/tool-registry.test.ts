/**
 * tool-registry.test.ts — assertions for the tool-registry lookup table.
 *
 * Spec ref: openspec/changes/add-full-tool-surface/specs/server-mutation-bridge/spec.md
 *   "Tool registry enumerates the full agent tool surface"
 */

import { describe, expect, mock, test } from "bun:test";
import { toolRegistry, type ToolRegistryDeps } from "./tool-registry";
import type { ListCanvasesResult } from "./list-canvases-reader";

describe("toolRegistry — composition", () => {
  test("contains exactly thirteen entries (M15 added listCanvases + listShapes)", () => {
    expect(Object.keys(toolRegistry).length).toBe(13);
  });

  test("has exactly six write entries and seven read entries", () => {
    const all = Object.values(toolRegistry);
    const writes = all.filter((e) => e.kind === "write");
    const reads = all.filter((e) => e.kind === "read");
    expect(writes).toHaveLength(6);
    expect(reads).toHaveLength(7);
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

  test("every entry has a non-empty description for LLM tool-surface consumption", () => {
    // Spec: openspec/specs/server-mutation-bridge/spec.md
    //   "Tool registry enumerates the full agent tool surface".
    //
    // The agent runtime (M13.6) projects each entry into a ProviderToolDef
    // and forwards the `description` to the underlying LLM provider.
    // OpenAI / Anthropic / Google all rely on tool descriptions to decide
    // when and how to invoke a tool — empty descriptions mean the LLM
    // omits required arguments (the M13 e2e finding that triggered §13).
    for (const entry of Object.values(toolRegistry)) {
      expect(typeof entry.description).toBe("string");
      expect(entry.description.length).toBeGreaterThan(20);
    }
  });

  test("createShape description names the four custom shape types and their required props", () => {
    // The LLM has no other source of truth for what props each shape type
    // expects. Without listing them here, OpenAI strict mode strips the
    // (optional) `props` argument and the mutator's tldraw schema rejects
    // the resulting record. Tested types — markdown, code, callout,
    // link-card — match `apps/api/src/sync/shape-schemas.ts`.
    const desc = toolRegistry.createShape.description;
    for (const shapeType of ["markdown", "code", "callout", "link-card"]) {
      expect(desc).toContain(shapeType);
    }
    // Spot-check that the per-type required-prop names appear at least once
    // each so the LLM has a concrete handle to populate them.
    expect(desc).toContain("content");
    expect(desc).toContain("source");
    expect(desc).toContain("language");
    expect(desc).toContain("variant");
    expect(desc).toContain("body");
    expect(desc).toContain("url");
  });

  test("createShape description teaches the LLM about type='geo' with variant/color/text", () => {
    const desc = toolRegistry.createShape.description;
    expect(desc).toContain("geo");
    // At least one geo variant — rectangle is the canonical default.
    expect(desc).toContain("rectangle");
    // At least one other variant so the model knows the list is not just rect.
    expect(desc).toMatch(/ellipse|triangle|diamond|star|arrow-right/);
    // Color palette hint.
    expect(desc).toMatch(/color/);
    expect(desc).toMatch(/red|blue|green|violet/);
    // Fill mode hint.
    expect(desc).toMatch(/fill/);
    expect(desc).toMatch(/solid|semi|none/);
    // Optional text label hint.
    expect(desc).toMatch(/text/);
  });

  test("updateShape description enumerates per-shape-type patch keys (M14)", () => {
    const desc = toolRegistry.updateShape.description;
    for (const shapeType of ["markdown", "code", "callout", "link-card"]) {
      expect(desc).toContain(shapeType);
    }
    // At least one writable patch key per custom shape type must be named.
    expect(desc).toMatch(/content/); // markdown
    expect(desc).toMatch(/source|language/); // code
    expect(desc).toMatch(/variant|body/); // callout
    expect(desc).toMatch(/url|metadata/); // link-card
  });

  test("updateShape description teaches the LLM how to update a geo shape", () => {
    const desc = toolRegistry.updateShape.description;
    expect(desc).toContain("geo");
    // At least one writable geo prop must be named so the model knows what
    // it is allowed to change on a geometric shape.
    expect(desc).toMatch(/color|fill|text/);
  });

  test("connectShapes description names start/end ids and at least one arrow style prop (M14)", () => {
    const desc = toolRegistry.connectShapes.description;
    expect(desc).toContain("fromId");
    expect(desc).toContain("toId");
    // Must mention at least one of color / dash / bend.
    expect(desc).toMatch(/color|dash|bend/);
  });

  test("groupShapes description explains group behavior (M14)", () => {
    const desc = toolRegistry.groupShapes.description;
    // Children retain their absolute positions on the canvas.
    expect(desc).toMatch(/absolute position/i);
    // Group itself has no editable props.
    expect(desc).toMatch(/no editable props|cannot updateShape against the group/i);
  });

  test("all thirteen expected tool names are present (M15 added listCanvases + listShapes)", () => {
    const expected = [
      "createShape",
      "updateShape",
      "deleteShape",
      "groupShapes",
      "ungroupShape",
      "connectShapes",
      "listShapes",
      "listShapesInViewport",
      "listShapesInSelection",
      "getShape",
      "getCanvasBounds",
      "getViewport",
      "listCanvases",
    ].sort();
    const actual = Object.keys(toolRegistry).sort();
    expect(actual).toEqual(expected);
  });

  test("listCanvases description signals user-scoped discovery + accessible + role", () => {
    const desc = toolRegistry.listCanvases.description;
    expect(desc.toLowerCase()).toContain("list canvases");
    expect(desc.toLowerCase()).toMatch(/access|accessible/);
    expect(desc.toLowerCase()).toContain("role");
  });

  test("listCanvases execute routes through listCanvasesForUser ignoring canvasId", async () => {
    const fakeListCanvasesDeps = {
      queryOwnedCanvases: mock(async (uid: string) => {
        return uid === "user-42"
          ? [
              { id: "c1", title: "A" },
              { id: "c2", title: "B" },
            ]
          : [];
      }),
      querySharedCanvases: mock(async () => []),
    };
    const deps = {
      registry: { getRoom: () => undefined },
      sessionUserId: "user-42",
      listCanvasesDeps: fakeListCanvasesDeps,
    } as unknown as ToolRegistryDeps;

    // Cast to a concrete signature — the polymorphic union in toolRegistry
    // makes TS widen `input` to an intersection of every entry's input type.
    const execute = toolRegistry.listCanvases.execute as (
      d: ToolRegistryDeps,
      canvasId: string,
      input: Record<string, never>,
    ) => Promise<ListCanvasesResult>;

    const result = await execute(deps, "ignored-canvas-id", {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((c) => c.id)).toEqual(["c1", "c2"]);
      expect(result.data.every((c) => c.role === "owner")).toBe(true);
    }
    // canvasId argument was ignored; reader called with userId only.
    expect(fakeListCanvasesDeps.queryOwnedCanvases).toHaveBeenCalledWith("user-42");
  });

  test("listCanvases execute returns depsMissing errorKey when sessionUserId or listCanvasesDeps absent", async () => {
    const deps = {
      registry: { getRoom: () => undefined },
    } as unknown as ToolRegistryDeps;
    const execute = toolRegistry.listCanvases.execute as (
      d: ToolRegistryDeps,
      canvasId: string,
      input: Record<string, never>,
    ) => Promise<ListCanvasesResult>;
    const result = await execute(deps, "any-canvas", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe("errors.listCanvases.depsMissing");
    }
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
