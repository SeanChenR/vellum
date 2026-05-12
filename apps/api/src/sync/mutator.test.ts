/**
 * mutator.test.ts — unit tests for Server tldraw Mutator.
 *
 * Spec ref: openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 *
 * The mutator is exercised against a stub `SyncRoomLike` that records calls
 * to `updateStore`. Real TLSocketRoom integration is covered separately by
 * mutator-integration.test.ts.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Mutation } from "@vellum/shared/mutation-types";
import type { RoomRegistry, SyncRoomLike } from "./room";
import { applyMutation, type ApplyMutationDeps } from "./mutator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANVAS_ID = "canvas-1";

interface StubRoom extends SyncRoomLike {
  updateStore: ReturnType<typeof mock>;
}

interface StubStore {
  put: ReturnType<typeof mock>;
  get: ReturnType<typeof mock>;
  delete: ReturnType<typeof mock>;
  getAll: ReturnType<typeof mock>;
  /** Inspect what the store ended up holding after the updater ran. */
  records(): Map<string, Record<string, unknown>>;
}

/**
 * Build a stub TLSocketRoom that backs `RoomStoreMethods` with an
 * in-memory Map. The stub mirrors tldraw's `updateStore` semantics: the
 * updater runs against a transactional buffer; if it throws, no
 * commits happen.
 *
 * @param seed - records to pre-populate the store with (keyed by id)
 */
function makeStubRoom(seed: Record<string, unknown>[] = []): {
  room: StubRoom;
  lastStore: StubStore | null;
} {
  const ctx: { lastStore: StubStore | null; committed: Map<string, Record<string, unknown>> } = {
    lastStore: null,
    committed: new Map(),
  };
  for (const r of seed) {
    const id = (r as { id?: string }).id;
    if (id) ctx.committed.set(id, r as Record<string, unknown>);
  }

  const updateStore = mock(async (updater: (store: StubStore) => void | Promise<void>) => {
    // Snapshot of committed records the updater starts with; mutations
    // happen on a working copy so a thrown updater leaves the room
    // unchanged (mirrors `room.updateStore`'s atomic-on-throw semantic).
    const working = new Map(ctx.committed);
    const store: StubStore = {
      put: mock((record: Record<string, unknown>) => {
        const id = record["id"];
        if (typeof id !== "string") throw new Error("record requires id");
        working.set(id, record);
      }),
      get: mock((id: string) => working.get(id) ?? null),
      delete: mock((idOrRecord: string | { id: string }) => {
        const id = typeof idOrRecord === "string" ? idOrRecord : idOrRecord.id;
        working.delete(id);
      }),
      getAll: mock(() => Array.from(working.values())),
      records: () => working,
    };
    ctx.lastStore = store;
    await updater(store);
    // Updater did not throw → commit working copy.
    ctx.committed = working;
  });

  const room: StubRoom = {
    getCurrentSnapshot: mock(() => ({
      documents: Array.from(ctx.committed.values()).map(
        (state) => ({ state, lastChangedClock: 0 }) as never,
      ),
      schema: undefined as never,
    })),
    isClosed: mock(() => false),
    close: mock(() => {}),
    updateStore,
  } as unknown as StubRoom;

  return {
    room,
    get lastStore() {
      return ctx.lastStore;
    },
  } as never;
}

function makeRegistry(canvasId: string, room: StubRoom | null): RoomRegistry {
  return {
    getRoom: mock((id: string) => (id === canvasId ? room : undefined)),
  } as unknown as RoomRegistry;
}

const VALID_CREATE_SHAPE: Mutation = {
  type: "createShape",
  payload: {
    id: "shape:abc",
    type: "geo",
    x: 100,
    y: 100,
    props: { color: "blue" },
  },
};

const VALID_CREATE_SHAPE_B: Mutation = {
  type: "createShape",
  payload: {
    id: "shape:def",
    type: "geo",
    x: 200,
    y: 200,
    props: { color: "red" },
  },
};

let deps: ApplyMutationDeps;
let stub: ReturnType<typeof makeStubRoom>;

beforeEach(() => {
  stub = makeStubRoom();
  deps = { registry: makeRegistry(CANVAS_ID, stub.room) };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyMutation — happy path", () => {
  test("single createShape against active room resolves ok and runs the batch updater once", async () => {
    const result = await applyMutation(deps, CANVAS_ID, [VALID_CREATE_SHAPE]);

    expect(result).toEqual({ ok: true, appliedCount: 1 });
    expect(stub.room.updateStore).toHaveBeenCalledTimes(1);
  });
});

describe("applyMutation — invalid input", () => {
  test("schema-invalid payload rejects with errors.devMutate.invalidPayload and never touches the room", async () => {
    const bad = {
      type: "createShape",
      payload: {
        /* missing required fields */
      },
    } as unknown as Mutation;

    const result = await applyMutation(deps, CANVAS_ID, [bad]);

    expect(result).toEqual({ ok: false, errorKey: "errors.devMutate.invalidPayload" });
    expect(stub.room.updateStore).not.toHaveBeenCalled();
  });
});

describe("applyMutation — no active room", () => {
  test("rejects with errors.devMutate.canvasNotInActiveRoom when registry returns undefined", async () => {
    const emptyDeps: ApplyMutationDeps = { registry: makeRegistry(CANVAS_ID, null) };
    const result = await applyMutation(emptyDeps, "other-canvas", [VALID_CREATE_SHAPE]);

    expect(result).toEqual({ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" });
    expect(stub.room.updateStore).not.toHaveBeenCalled();
  });
});

describe("applyMutation — batch semantics", () => {
  test("two mutations in one call go through a single updateStore invocation", async () => {
    const result = await applyMutation(deps, CANVAS_ID, [VALID_CREATE_SHAPE, VALID_CREATE_SHAPE_B]);

    expect(result).toEqual({ ok: true, appliedCount: 2 });
    // Crucially: ONE batch, not two — preserves single-undo semantics on the client.
    expect(stub.room.updateStore).toHaveBeenCalledTimes(1);
  });
});

describe("applyMutation — error containment", () => {
  test("unexpected throw inside updateStore is caught and returned as mutationFailed", async () => {
    const room = stub.room;
    room.updateStore.mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const result = await applyMutation(deps, CANVAS_ID, [VALID_CREATE_SHAPE]);

    expect(result).toEqual({ ok: false, errorKey: "errors.devMutate.mutationFailed" });
  });
});

// ---------------------------------------------------------------------------
// M12.2 — write variants beyond createShape
// ---------------------------------------------------------------------------

const SEED_GEO_A = {
  id: "shape:src",
  typeName: "shape",
  type: "geo",
  x: 10,
  y: 20,
  rotation: 0,
  isLocked: false,
  opacity: 1,
  parentId: "page:page",
  index: "a1",
  meta: {},
  props: { color: "red", w: 100 },
};
const SEED_GEO_B = {
  id: "shape:dst",
  typeName: "shape",
  type: "geo",
  x: 200,
  y: 200,
  rotation: 0,
  isLocked: false,
  opacity: 1,
  parentId: "page:page",
  index: "a2",
  meta: {},
  props: { color: "blue", w: 50 },
};

function depsWith(seed: Record<string, unknown>[]): {
  deps: ApplyMutationDeps;
  stub: ReturnType<typeof makeStubRoom>;
} {
  const s = makeStubRoom(seed);
  return { stub: s, deps: { registry: makeRegistry(CANVAS_ID, s.room) } };
}

describe("applyMutation — updateShape variant", () => {
  test("merges partial onto existing record (top-level + props)", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "updateShape",
        payload: { id: "shape:src", partial: { x: 50, props: { color: "blue" } } },
      },
    ]);

    expect(result).toEqual({ ok: true, appliedCount: 1 });
    const merged = s.lastStore?.records().get("shape:src");
    expect(merged).toMatchObject({
      id: "shape:src",
      type: "geo",
      x: 50,
      y: 20,
      props: { color: "blue", w: 100 },
    });
  });

  test("rejects unknown shape id with shapeNotFound, room state unchanged", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "updateShape",
        payload: { id: "shape:does-not-exist", partial: { x: 0 } },
      },
    ]);

    expect(result).toEqual({ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" });
    // Stub commits only on clean updater run — committed records preserved.
    const snap = s.room.getCurrentSnapshot();
    expect(snap.documents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Geo shape normalisation — tldraw `geo` records need a full prop set; the
// mutator fills the gaps so the LLM agent surface can stay minimal.
// ---------------------------------------------------------------------------

describe("applyMutation — geo createShape backfills required props", () => {
  test("fills tldraw-required defaults (geo/dash/fill/size/font/align/.../richText)", async () => {
    const { deps: d, stub: s } = depsWith([]);
    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "createShape",
        payload: {
          id: "shape:g1",
          type: "geo",
          x: 0,
          y: 0,
          props: { color: "red" },
        },
      },
    ]);
    expect(result).toEqual({ ok: true, appliedCount: 1 });
    const stored = s.lastStore?.records().get("shape:g1");
    expect(stored?.props).toMatchObject({
      geo: "rectangle",
      color: "red",
      fill: "none",
      dash: "draw",
      size: "m",
      font: "draw",
      align: "middle",
      verticalAlign: "middle",
      labelColor: "black",
      url: "",
      growY: 0,
      scale: 1,
    });
    expect((stored?.props as Record<string, unknown>)?.richText).toMatchObject({ type: "doc" });
  });

  test("user-supplied geo + color + text are honoured", async () => {
    const { deps: d, stub: s } = depsWith([]);
    await applyMutation(d, CANVAS_ID, [
      {
        type: "createShape",
        payload: {
          id: "shape:g2",
          type: "geo",
          x: 0,
          y: 0,
          props: { geo: "ellipse", color: "blue", text: "label" },
        },
      },
    ]);
    const stored = s.lastStore?.records().get("shape:g2");
    expect(stored?.props).toMatchObject({ geo: "ellipse", color: "blue" });
    expect((stored?.props as Record<string, unknown>)?.text).toBeUndefined();
    expect(JSON.stringify((stored?.props as Record<string, unknown>)?.richText)).toContain("label");
  });

  test("non-geo shape types are NOT normalised", async () => {
    const { deps: d, stub: s } = depsWith([]);
    await applyMutation(d, CANVAS_ID, [
      {
        type: "createShape",
        payload: {
          id: "shape:m1",
          type: "markdown",
          x: 0,
          y: 0,
          props: { content: "hello", w: 320, h: 180 },
        },
      },
    ]);
    const stored = s.lastStore?.records().get("shape:m1");
    expect(stored?.props).toEqual({ content: "hello", w: 320, h: 180 });
  });
});

describe("applyMutation — geo updateShape converts text → richText", () => {
  const SEED_GEO_C = {
    id: "shape:gu",
    typeName: "shape",
    type: "geo",
    x: 0,
    y: 0,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    parentId: "page:page",
    index: "a1",
    meta: {},
    props: { geo: "rectangle", color: "black" },
  };

  test("partial with text converts to richText without injecting other defaults", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_C]);
    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "updateShape",
        payload: { id: "shape:gu", partial: { props: { text: "new" } } },
      },
    ]);
    expect(result).toEqual({ ok: true, appliedCount: 1 });
    const stored = s.lastStore?.records().get("shape:gu");
    const props = stored?.props as Record<string, unknown>;
    expect(props.text).toBeUndefined();
    expect(JSON.stringify(props.richText)).toContain("new");
    // Existing color preserved (no clobber by default values).
    expect(props.color).toBe("black");
  });

  test("partial with non-text props passes through unchanged", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_C]);
    await applyMutation(d, CANVAS_ID, [
      {
        type: "updateShape",
        payload: { id: "shape:gu", partial: { props: { color: "violet" } } },
      },
    ]);
    const stored = s.lastStore?.records().get("shape:gu");
    expect(((stored?.props ?? {}) as Record<string, unknown>).color).toBe("violet");
  });
});

describe("applyMutation — deleteShape variant", () => {
  test("removes existing shape", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A]);

    const result = await applyMutation(d, CANVAS_ID, [
      { type: "deleteShape", payload: { id: "shape:src" } },
    ]);

    expect(result).toEqual({ ok: true, appliedCount: 1 });
    expect(s.lastStore?.records().get("shape:src")).toBeUndefined();
  });

  test("rejects unknown shape id with shapeNotFound", async () => {
    const { deps: d } = depsWith([]);

    const result = await applyMutation(d, CANVAS_ID, [
      { type: "deleteShape", payload: { id: "shape:ghost" } },
    ]);

    expect(result).toEqual({ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" });
  });
});

describe("applyMutation — groupShapes variant", () => {
  test("creates group record and reparents children atomically", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A, SEED_GEO_B]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "groupShapes",
        payload: { shapeIds: ["shape:src", "shape:dst"], groupId: "shape:grp1" },
      },
    ]);

    expect(result).toEqual({ ok: true, appliedCount: 1 });
    const records = s.lastStore?.records();
    const group = records?.get("shape:grp1");
    expect(group).toMatchObject({ id: "shape:grp1", type: "group", parentId: "page:page" });
    expect(records?.get("shape:src")?.["parentId"]).toBe("shape:grp1");
    expect(records?.get("shape:dst")?.["parentId"]).toBe("shape:grp1");
  });

  test("rejects when any child does not exist (atomic abort)", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "groupShapes",
        payload: { shapeIds: ["shape:src", "shape:missing"], groupId: "shape:grp2" },
      },
    ]);

    expect(result).toEqual({ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" });
    // Stub does not commit on throw — group record absent + parent unchanged.
    const snap = s.room.getCurrentSnapshot();
    const docs = snap.documents.map((d) => d.state) as unknown as Record<string, unknown>[];
    expect(docs.find((r) => r["id"] === "shape:grp2")).toBeUndefined();
    expect(docs.find((r) => r["id"] === "shape:src")?.["parentId"]).toBe("page:page");
  });
});

describe("applyMutation — ungroupShape variant", () => {
  test("re-parents children to the group's parent and removes the group", async () => {
    const groupRecord = {
      id: "shape:grp1",
      typeName: "shape",
      type: "group",
      parentId: "page:page",
      index: "a0",
      meta: {},
      props: {},
      x: 0,
      y: 0,
      rotation: 0,
      isLocked: false,
      opacity: 1,
    };
    const child1 = { ...SEED_GEO_A, parentId: "shape:grp1" };
    const child2 = { ...SEED_GEO_B, parentId: "shape:grp1" };
    const { deps: d, stub: s } = depsWith([groupRecord, child1, child2]);

    const result = await applyMutation(d, CANVAS_ID, [
      { type: "ungroupShape", payload: { groupId: "shape:grp1" } },
    ]);

    expect(result).toEqual({ ok: true, appliedCount: 1 });
    const records = s.lastStore?.records();
    expect(records?.get("shape:grp1")).toBeUndefined();
    expect(records?.get("shape:src")?.["parentId"]).toBe("page:page");
    expect(records?.get("shape:dst")?.["parentId"]).toBe("page:page");
  });

  test("rejects when target is not a group", async () => {
    const { deps: d } = depsWith([SEED_GEO_A]);

    const result = await applyMutation(d, CANVAS_ID, [
      { type: "ungroupShape", payload: { groupId: "shape:src" } },
    ]);

    expect(result).toEqual({ ok: false, errorKey: "errors.fullToolSurface.groupNotFound" });
  });

  test("rejects when group does not exist", async () => {
    const { deps: d } = depsWith([]);

    const result = await applyMutation(d, CANVAS_ID, [
      { type: "ungroupShape", payload: { groupId: "shape:missing" } },
    ]);

    expect(result).toEqual({ ok: false, errorKey: "errors.fullToolSurface.groupNotFound" });
  });
});

describe("applyMutation — connectShapes variant", () => {
  test("creates arrow + start + end binding records atomically", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A, SEED_GEO_B]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "connectShapes",
        payload: {
          fromId: "shape:src",
          toId: "shape:dst",
          arrowId: "shape:arrow1",
          label: "auth",
        },
      },
    ]);

    expect(result).toEqual({ ok: true, appliedCount: 1 });
    const records = s.lastStore?.records();
    const arrow = records?.get("shape:arrow1");
    expect(arrow).toMatchObject({ id: "shape:arrow1", type: "arrow" });
    // Two binding records exist (one per terminal).
    const bindings = Array.from(records?.values() ?? []).filter((r) =>
      String((r as { id?: string }).id ?? "").startsWith("binding:"),
    );
    expect(bindings).toHaveLength(2);
    const terminals = bindings.map((b) => (b as { props?: { terminal?: string } }).props?.terminal);
    expect(terminals.sort()).toEqual(["end", "start"]);
  });

  test("rejects when an endpoint does not exist", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "connectShapes",
        payload: { fromId: "shape:src", toId: "shape:absent", arrowId: "shape:arrow2" },
      },
    ]);

    expect(result).toEqual({ ok: false, errorKey: "errors.fullToolSurface.shapeNotFound" });
    // Atomic abort — no arrow + no bindings committed.
    const docs = s.room.getCurrentSnapshot().documents.map((d) => d.state) as unknown as Record<
      string,
      unknown
    >[];
    expect(docs.find((r) => r["id"] === "shape:arrow2")).toBeUndefined();
    expect(docs.filter((r) => String(r["id"] ?? "").startsWith("binding:"))).toHaveLength(0);
  });
});

describe("applyMutation — multi-variant batch", () => {
  test("create + update + connect in one call commits as one batch", async () => {
    const { deps: d, stub: s } = depsWith([SEED_GEO_A, SEED_GEO_B]);

    const result = await applyMutation(d, CANVAS_ID, [
      {
        type: "createShape",
        payload: {
          id: "shape:new",
          type: "geo",
          x: 0,
          y: 0,
          props: { color: "green", w: 50, h: 50 },
        },
      },
      { type: "updateShape", payload: { id: "shape:src", partial: { x: 99 } } },
      {
        type: "connectShapes",
        payload: { fromId: "shape:src", toId: "shape:dst", arrowId: "shape:arr" },
      },
    ]);

    expect(result).toEqual({ ok: true, appliedCount: 3 });
    expect(s.room.updateStore).toHaveBeenCalledTimes(1);
    const records = s.lastStore?.records();
    expect(records?.get("shape:new")).toBeDefined();
    expect(records?.get("shape:src")?.["x"]).toBe(99);
    expect(records?.get("shape:arr")).toBeDefined();
  });
});
