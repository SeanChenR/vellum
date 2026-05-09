/**
 * digest.test.ts — canvas digest builder for agent system context.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/canvas-digest/spec.md
 *
 * Design ref:
 *   openspec/changes/add-agent-runtime-streaming/design.md
 *     "Canvas digest: 輕量 header + 既有 read tools 自取"
 */

import { describe, expect, it } from "bun:test";
import type { MutatorReadersDeps } from "../sync/mutator-readers";
import { buildCanvasDigest } from "./digest";

interface FakeShape {
  id: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  body?: string; // would-be content; SHALL NOT appear in digest
}

function makeFakeRoom(opts: {
  shapes: FakeShape[];
  presence?: {
    sessionId: string;
    selection?: string[];
    viewport?: { x: number; y: number; w: number; h: number };
  };
}) {
  const documents = opts.shapes.map((s) => ({
    state: {
      typeName: "shape",
      id: s.id,
      type: s.type,
      x: s.x,
      y: s.y,
      props: {
        w: s.w ?? 100,
        h: s.h ?? 50,
        body: s.body ?? "",
      },
    } as Record<string, unknown>,
  }));

  const presence: Record<string, Record<string, unknown>> = {};
  if (opts.presence) {
    presence[`instance_presence:${opts.presence.sessionId}`] = {
      sessionId: opts.presence.sessionId,
      selectedShapeIds: opts.presence.selection ?? [],
      camera: opts.presence.viewport
        ? { x: -opts.presence.viewport.x, y: -opts.presence.viewport.y, z: 1 }
        : { x: 0, y: 0, z: 1 },
      screenBounds: opts.presence.viewport
        ? { x: 0, y: 0, w: opts.presence.viewport.w, h: opts.presence.viewport.h }
        : { x: 0, y: 0, w: 1920, h: 1080 },
    };
  }

  return {
    getCurrentSnapshot() {
      return { documents };
    },
    getPresenceRecords() {
      return presence;
    },
  };
}

function makeDeps(room: ReturnType<typeof makeFakeRoom> | undefined): MutatorReadersDeps {
  return {
    registry: {
      getRoom: () => room as never,
    } as unknown as MutatorReadersDeps["registry"],
  };
}

describe("buildCanvasDigest — schema & contents", () => {
  it("emits exactly the documented fields with correct counts", async () => {
    const room = makeFakeRoom({
      shapes: [
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `shape:md-${i}`,
          type: "markdown",
          x: i * 100,
          y: 0,
          body: `body content ${i}`,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `shape:code-${i}`,
          type: "code",
          x: 0,
          y: i * 100,
          body: "console.log()",
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `shape:link-${i}`,
          type: "link",
          x: 200,
          y: i * 100,
          body: "https://example.com",
        })),
      ],
      presence: {
        sessionId: "sess-1",
        selection: ["shape:md-0", "shape:md-1"],
        viewport: { x: 0, y: 0, w: 1920, h: 1080 },
      },
    });

    const digest = await buildCanvasDigest(makeDeps(room), {
      canvasId: "cnv_abc",
      title: "Sprint planning",
      sessionId: "sess-1",
    });

    expect(digest.canvasId).toBe("cnv_abc");
    expect(digest.title).toBe("Sprint planning");
    expect(digest.shapeCounts).toEqual({ markdown: 12, code: 3, link: 5 });
    expect(digest.selection).toEqual([
      { id: "shape:md-0", type: "markdown" },
      { id: "shape:md-1", type: "markdown" },
    ]);
    expect(digest.viewport).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });

    // Verify it has the documented field set and nothing else.
    expect(Object.keys(digest).sort()).toEqual([
      "bounds",
      "canvasId",
      "selection",
      "shapeCounts",
      "title",
      "viewport",
    ]);
  });

  it("never includes shape contents, props, or per-shape geometry", async () => {
    const room = makeFakeRoom({
      shapes: [
        {
          id: "shape:big",
          type: "markdown",
          x: 0,
          y: 0,
          body: "X".repeat(50_000),
        },
      ],
    });

    const digest = await buildCanvasDigest(makeDeps(room), {
      canvasId: "cnv",
      title: "t",
      sessionId: "sess",
    });

    const json = JSON.stringify(digest);
    expect(json).not.toContain("X".repeat(100));
    // selection is [] when there is no presence
    expect(digest.selection).toEqual([]);
    expect(digest.shapeCounts).toEqual({ markdown: 1 });
  });

  it("digest size scales with structural fields, not shape body size", async () => {
    const small = makeFakeRoom({
      shapes: [{ id: "shape:s1", type: "markdown", x: 0, y: 0, body: "tiny" }],
    });
    const big = makeFakeRoom({
      shapes: [{ id: "shape:s1", type: "markdown", x: 0, y: 0, body: "Y".repeat(100_000) }],
    });

    const dSmall = await buildCanvasDigest(makeDeps(small), {
      canvasId: "c",
      title: "t",
      sessionId: "s",
    });
    const dBig = await buildCanvasDigest(makeDeps(big), {
      canvasId: "c",
      title: "t",
      sessionId: "s",
    });

    // Lengths SHALL be identical because no body content leaks into digest.
    expect(JSON.stringify(dSmall).length).toBe(JSON.stringify(dBig).length);
  });
});

describe("buildCanvasDigest — bounds & viewport", () => {
  it("computes overall bounds from min/max corner of every shape", async () => {
    const room = makeFakeRoom({
      shapes: [
        { id: "shape:a", type: "markdown", x: -200, y: -100, w: 100, h: 50 },
        { id: "shape:b", type: "code", x: 3800, y: 2300, w: 200, h: 100 },
      ],
    });

    const digest = await buildCanvasDigest(makeDeps(room), {
      canvasId: "c",
      title: "t",
      sessionId: "s",
    });

    expect(digest.bounds).toEqual({ x: -200, y: -100, w: 4200, h: 2500 });
  });

  it("emits zero-bounds when canvas has no shapes", async () => {
    const room = makeFakeRoom({ shapes: [] });
    const digest = await buildCanvasDigest(makeDeps(room), {
      canvasId: "c",
      title: "t",
      sessionId: "s",
    });
    expect(digest.bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(digest.shapeCounts).toEqual({});
  });

  it("emits zero-viewport when session has no presence record", async () => {
    const room = makeFakeRoom({
      shapes: [{ id: "shape:a", type: "markdown", x: 0, y: 0 }],
    });
    const digest = await buildCanvasDigest(makeDeps(room), {
      canvasId: "c",
      title: "t",
      sessionId: "absent-session",
    });
    expect(digest.viewport).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("buildCanvasDigest — deps reuse", () => {
  it("accepts the same MutatorReadersDeps a test injects into M12.2 readers", async () => {
    // The deps object passed below is the same shape M12.2 readers use,
    // so a test can share one fake registry across both layers.
    const room = makeFakeRoom({
      shapes: [{ id: "shape:a", type: "markdown", x: 0, y: 0 }],
    });
    const deps: MutatorReadersDeps = makeDeps(room);
    const digest = await buildCanvasDigest(deps, {
      canvasId: "c",
      title: "t",
      sessionId: "s",
    });
    expect(digest.shapeCounts).toEqual({ markdown: 1 });
  });

  it("returns zero-everything when the canvas room is missing", async () => {
    const digest = await buildCanvasDigest(makeDeps(undefined), {
      canvasId: "missing",
      title: "t",
      sessionId: "s",
    });
    expect(digest.shapeCounts).toEqual({});
    expect(digest.bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(digest.viewport).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(digest.selection).toEqual([]);
  });
});
