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
}

function makeStubRoom(): { room: StubRoom; lastStore: StubStore | null } {
  const ctx: { lastStore: StubStore | null } = { lastStore: null };
  const updateStore = mock(async (updater: (store: StubStore) => void | Promise<void>) => {
    const store: StubStore = {
      put: mock((_record: unknown) => {}),
      get: mock(() => undefined),
    };
    ctx.lastStore = store;
    await updater(store);
  });
  const room: StubRoom = {
    getCurrentSnapshot: mock(() => ({ documents: [], schema: undefined as never })),
    isClosed: mock(() => false),
    close: mock(() => {}),
    updateStore,
    // Cast: TLSocketRoom has updateStore but our SyncRoomLike interface
    // does not include it (registry-level concern); mutator narrows via deps.
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
