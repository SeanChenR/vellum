/**
 * methods/tools-call.test.ts — MCP tools/call handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "tools/call dispatches to the existing tool-registry execute path
 *      with permission enforcement"
 *   - Scenarios: createShape dispatches mutator; cross-user canvas →
 *     invalidRequest; viewer on write → invalidRequest; listCanvases
 *     bypass; invalidArgs; toolUnknown.
 */

import { describe, expect, mock, test } from "bun:test";
import { handleToolsCall, type ToolsCallDeps } from "./tools-call";
import { JSONRPC_APP_ERROR } from "../jsonrpc";
import type { CanvasRole, PermissionGuardDeps } from "../../lib/permission-guard";

const USER_A = "user-A";
const CANVAS_ID = "canvas-1";
const ID = "rpc-1";

function buildDeps(opts: {
  role?: CanvasRole | null;
  canvasExists?: boolean;
  applyMutation?: ToolsCallDeps["toolRegistryDeps"]["applyMutation"];
  appliedMutations?: Array<{ canvasId: string; mutations: unknown[] }>;
  listCanvasesDeps?: ToolsCallDeps["toolRegistryDeps"]["listCanvasesDeps"];
}): ToolsCallDeps {
  const applied = opts.appliedMutations ?? [];
  const applyMutation =
    opts.applyMutation ??
    (async (_d: unknown, canvasId: string, mutations: unknown[]) => {
      applied.push({ canvasId, mutations });
      return { ok: true as const, appliedCount: mutations.length };
    });
  const permission: PermissionGuardDeps = {
    resolveCanvasRole: async () => ({
      canvasExists: opts.canvasExists ?? true,
      role: opts.role === undefined ? "owner" : opts.role,
    }),
  };
  return {
    permission,
    toolRegistryDeps: {
      registry: {
        getRoom: () => undefined,
      } as unknown as ToolsCallDeps["toolRegistryDeps"]["registry"],
      applyMutation: applyMutation as ToolsCallDeps["toolRegistryDeps"]["applyMutation"],
      sessionUserId: USER_A,
      listCanvasesDeps: opts.listCanvasesDeps,
    } as unknown as ToolsCallDeps["toolRegistryDeps"],
  };
}

describe("handleToolsCall — happy path", () => {
  test("createShape with owner role dispatches mutator and wraps result", async () => {
    const applied: Array<{ canvasId: string; mutations: unknown[] }> = [];
    const deps = buildDeps({ role: "owner", appliedMutations: applied });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "createShape",
      arguments: {
        canvasId: CANVAS_ID,
        id: "shape:abc",
        type: "geo",
        x: 0,
        y: 0,
        props: {},
      },
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.isError).toBe(false);
      expect(out.result.content).toHaveLength(1);
      expect(out.result.content[0]!.type).toBe("text");
      const parsedResult = JSON.parse(out.result.content[0]!.text) as {
        ok: boolean;
        appliedCount: number;
      };
      expect(parsedResult.ok).toBe(true);
      expect(parsedResult.appliedCount).toBe(1);
    }
    expect(applied).toHaveLength(1);
    expect(applied[0]!.canvasId).toBe(CANVAS_ID);
  });
});

describe("handleToolsCall — permission boundaries", () => {
  test("cross-user canvas (no role) returns -32000 invalidRequest", async () => {
    const deps = buildDeps({ role: null, canvasExists: true });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "getShape",
      arguments: { canvasId: CANVAS_ID, shapeId: "shape:abc" },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.response.error.code).toBe(JSONRPC_APP_ERROR);
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "agent.error.invalidRequest",
      );
    }
  });

  test("non-existent canvas returns -32000 invalidRequest (no leak vs cross-user)", async () => {
    const deps = buildDeps({ canvasExists: false });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "getShape",
      arguments: { canvasId: CANVAS_ID, shapeId: "shape:abc" },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "agent.error.invalidRequest",
      );
    }
  });

  test("viewer role attempts write tool returns -32000 invalidRequest", async () => {
    const deps = buildDeps({ role: "viewer" });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "createShape",
      arguments: {
        canvasId: CANVAS_ID,
        id: "shape:abc",
        type: "geo",
        x: 0,
        y: 0,
        props: {},
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "agent.error.invalidRequest",
      );
    }
  });

  test("viewer role CAN call read tools (getShape, listShapesInViewport, etc.)", async () => {
    // The handler should NOT short-circuit reads for viewers. The
    // underlying read tool may still return its own ok:false (e.g.,
    // canvas not in active room) — but the permission gate must pass.
    const deps = buildDeps({ role: "viewer" });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "getShape",
      arguments: { canvasId: CANVAS_ID, shapeId: "shape:abc" },
    });
    // With registry.getRoom returning undefined, getShape returns
    // {ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom"}.
    // The handler should surface that as a JSON-RPC error (not a
    // permission failure).
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "errors.devMutate.canvasNotInActiveRoom",
      );
    }
  });

  test("listCanvases bypasses canvas permission check and returns user's accessible canvases", async () => {
    const listDeps = {
      queryOwnedCanvases: mock(async (uid: string) =>
        uid === USER_A
          ? [
              { id: "c1", title: "A" },
              { id: "c2", title: "B" },
              { id: "c3", title: "C" },
            ]
          : [],
      ),
      querySharedCanvases: mock(async (uid: string) =>
        uid === USER_A
          ? [
              { id: "c4", title: "D", role: "editor" as const },
              { id: "c5", title: "E", role: "viewer" as const },
            ]
          : [],
      ),
    };
    // Even with `role: null` (no canvas access), listCanvases must still work.
    const deps = buildDeps({ role: null, listCanvasesDeps: listDeps });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "listCanvases",
      arguments: {},
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      const parsedResult = JSON.parse(out.result.content[0]!.text) as {
        ok: boolean;
        data: Array<{ id: string; role: string }>;
      };
      expect(parsedResult.ok).toBe(true);
      expect(parsedResult.data).toHaveLength(5);
      const roles = parsedResult.data.map((d) => d.role).sort();
      expect(roles).toEqual(["editor", "owner", "owner", "owner", "viewer"]);
    }
  });
});

describe("handleToolsCall — error mapping", () => {
  test("unknown tool name returns -32000 toolUnknown", async () => {
    const deps = buildDeps({});
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "nonExistent",
      arguments: {},
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe("agent.tool.unknown");
    }
  });

  test("arguments failing Zod schema return -32000 invalidArgs", async () => {
    const deps = buildDeps({ role: "owner" });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "createShape",
      // Missing required fields (id, type, x, y, props).
      arguments: { canvasId: CANVAS_ID },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "agent.tool.invalidArgs",
      );
    }
  });

  test("missing canvasId on a canvas-scoped tool returns -32000 invalidRequest", async () => {
    const deps = buildDeps({});
    const out = await handleToolsCall(
      deps,
      { userId: USER_A },
      ID,
      // No canvasId field.
      { name: "getShape", arguments: { shapeId: "shape:abc" } },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "agent.error.invalidRequest",
      );
    }
  });

  test("missing/empty params returns -32000 invalidArgs", async () => {
    const deps = buildDeps({});
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, null);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "agent.tool.invalidArgs",
      );
    }
  });

  test("mutator throw with known errorKey surfaces that errorKey", async () => {
    const applyMutation = async () => {
      throw new Error("errors.devMutate.mutationFailed");
    };
    const deps = buildDeps({
      role: "owner",
      applyMutation: applyMutation as unknown as ToolsCallDeps["toolRegistryDeps"]["applyMutation"],
    });
    const out = await handleToolsCall(deps, { userId: USER_A }, ID, {
      name: "createShape",
      arguments: {
        canvasId: CANVAS_ID,
        id: "shape:abc",
        type: "geo",
        x: 0,
        y: 0,
        props: {},
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect((out.response.error.data as { errorKey: string }).errorKey).toBe(
        "errors.devMutate.mutationFailed",
      );
    }
  });
});
