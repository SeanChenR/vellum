/**
 * mutator-readers.test.ts — unit tests for the snapshot-derived read tools.
 *
 * Spec ref: openspec/changes/add-full-tool-surface/specs/server-mutation-bridge/spec.md
 *   "Mutator readers expose snapshot-derived read tools without mutating the room"
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { RoomRegistry, SyncRoomLike } from "./room";
import {
  listShapesInViewport,
  listShapesInSelection,
  getShape,
  getCanvasBounds,
  getViewport,
  type MutatorReadersDeps,
} from "./mutator-readers";

const CANVAS_ID = "canvas-1";

interface RoomLikeStub extends SyncRoomLike {
  getPresenceRecords: ReturnType<typeof mock>;
}

function shape(
  id: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    typeName: "shape",
    type: "geo",
    x,
    y,
    rotation: 0,
    parentId: "page:page",
    index: "a1",
    meta: {},
    props: {
      ...(w !== undefined ? { w } : {}),
      ...(h !== undefined ? { h } : {}),
      ...extra,
    },
  };
}

function presence(
  id: string,
  meta: {
    selectedShapeIds?: string[];
    cameraX?: number;
    cameraY?: number;
    screenW?: number;
    screenH?: number;
  },
) {
  return {
    id,
    typeName: "instance_presence",
    selectedShapeIds: meta.selectedShapeIds ?? [],
    camera: { x: meta.cameraX ?? 0, y: meta.cameraY ?? 0, z: 1 },
    screenBounds: { x: 0, y: 0, w: meta.screenW ?? 1024, h: meta.screenH ?? 768 },
  };
}

function makeRoomStub(opts: {
  shapes?: Array<ReturnType<typeof shape>>;
  presence?: Record<string, ReturnType<typeof presence>>;
}): RoomLikeStub {
  const docs = (opts.shapes ?? []).map((s) => ({ state: s, lastChangedClock: 0 }));
  return {
    getCurrentSnapshot: mock(() => ({
      documents: docs as never,
      schema: undefined as never,
    })),
    isClosed: mock(() => false),
    close: mock(() => {}),
    getPresenceRecords: mock(() => opts.presence ?? {}),
  } as unknown as RoomLikeStub;
}

function depsWith(room: RoomLikeStub | null): MutatorReadersDeps {
  return {
    registry: {
      getRoom: mock((id: string) => (id === CANVAS_ID ? room : undefined)),
    } as unknown as RoomRegistry<SyncRoomLike>,
  };
}

let room: RoomLikeStub;
let deps: MutatorReadersDeps;

beforeEach(() => {
  room = makeRoomStub({});
  deps = depsWith(room);
});

// ---------------------------------------------------------------------------
// getShape
// ---------------------------------------------------------------------------

describe("getShape", () => {
  test("returns the requested shape as a ShapeSummary", async () => {
    room = makeRoomStub({ shapes: [shape("shape:abc", 10, 20, 100, 50, { color: "red" })] });
    deps = depsWith(room);

    const r = await getShape(deps, CANVAS_ID, "shape:abc");

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        id: "shape:abc",
        type: "geo",
        x: 10,
        y: 20,
        w: 100,
        h: 50,
      });
    }
  });

  test("returns null when shape is absent", async () => {
    const r = await getShape(deps, CANVAS_ID, "shape:missing");
    expect(r).toEqual({ ok: true, data: null });
  });

  test("returns canvasNotInActiveRoom when no room exists", async () => {
    const d = depsWith(null);
    const r = await getShape(d, CANVAS_ID, "shape:abc");
    expect(r).toEqual({ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" });
  });
});

// ---------------------------------------------------------------------------
// listShapesInViewport — intersection matrix
// ---------------------------------------------------------------------------

describe("listShapesInViewport", () => {
  test("intersection matrix from spec example", async () => {
    room = makeRoomStub({
      shapes: [
        shape("shape:in", 0, 0, 50, 50),
        shape("shape:out", 500, 500, 50, 50),
        shape("shape:edge", 50, 50, 50, 50),
        shape("shape:corner", 99, 99, 2, 2),
      ],
    });
    deps = depsWith(room);

    const r = await listShapesInViewport(deps, CANVAS_ID, { x: 0, y: 0, w: 100, h: 100 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.data.map((s) => s.id).sort();
    expect(ids).toEqual(["shape:corner", "shape:edge", "shape:in"]);
  });

  test("rejects negative width", async () => {
    const r = await listShapesInViewport(deps, CANVAS_ID, { x: 0, y: 0, w: -5, h: 100 });
    expect(r).toEqual({ ok: false, errorKey: "errors.fullToolSurface.invalidViewport" });
  });

  test("rejects NaN dimensions", async () => {
    const r = await listShapesInViewport(deps, CANVAS_ID, {
      x: 0,
      y: 0,
      w: Number.NaN,
      h: 100,
    });
    expect(r).toEqual({ ok: false, errorKey: "errors.fullToolSurface.invalidViewport" });
  });
});

// ---------------------------------------------------------------------------
// getCanvasBounds
// ---------------------------------------------------------------------------

describe("getCanvasBounds", () => {
  test("returns null on empty room", async () => {
    const r = await getCanvasBounds(deps, CANVAS_ID);
    expect(r).toEqual({ ok: true, data: null });
  });

  test("returns min/max bounding box across multiple shapes", async () => {
    room = makeRoomStub({
      shapes: [
        shape("shape:a", 10, 20, 30, 40), // covers (10,20)-(40,60)
        shape("shape:b", 100, 100, 50, 50), // covers (100,100)-(150,150)
      ],
    });
    deps = depsWith(room);

    const r = await getCanvasBounds(deps, CANVAS_ID);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ x: 10, y: 20, w: 140, h: 130 });
    }
  });
});

// ---------------------------------------------------------------------------
// listShapesInSelection + getViewport
// ---------------------------------------------------------------------------

describe("listShapesInSelection", () => {
  test("returns selected shapes for a known session", async () => {
    room = makeRoomStub({
      shapes: [shape("shape:a", 0, 0), shape("shape:b", 0, 0), shape("shape:c", 0, 0)],
      presence: {
        "instance_presence:sess-1": presence("instance_presence:sess-1", {
          selectedShapeIds: ["shape:a", "shape:c"],
        }),
      },
    });
    deps = depsWith(room);

    const r = await listShapesInSelection(deps, CANVAS_ID, "sess-1");

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.data.map((s) => s.id).sort();
    expect(ids).toEqual(["shape:a", "shape:c"]);
  });

  test("returns sessionNotFound for unknown session", async () => {
    const r = await listShapesInSelection(deps, CANVAS_ID, "sess-ghost");
    expect(r).toEqual({ ok: false, errorKey: "errors.fullToolSurface.sessionNotFound" });
  });
});

describe("getViewport", () => {
  test("returns the viewport rectangle for a known session", async () => {
    room = makeRoomStub({
      presence: {
        "instance_presence:sess-1": presence("instance_presence:sess-1", {
          cameraX: 100,
          cameraY: 200,
          screenW: 1024,
          screenH: 768,
        }),
      },
    });
    deps = depsWith(room);

    const r = await getViewport(deps, CANVAS_ID, "sess-1");

    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      // Viewport in world coordinates: shifted by camera (negate camera).
      expect(r.data).toEqual({ x: -100, y: -200, w: 1024, h: 768 });
    }
  });

  test("returns sessionNotFound for unknown session", async () => {
    const r = await getViewport(deps, CANVAS_ID, "sess-missing");
    expect(r).toEqual({ ok: false, errorKey: "errors.fullToolSurface.sessionNotFound" });
  });
});
