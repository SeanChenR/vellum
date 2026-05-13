/**
 * dispatch.test.ts — JSON-RPC method router.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "Stateless Streamable HTTP endpoint accepts JSON-RPC 2.0 at POST /api/mcp"
 *   - "Unknown method returns -32601"
 *   - Routes initialize / ping / tools/list / tools/call to the right handler.
 */

import { describe, expect, test } from "bun:test";
import { dispatchMcpRequest, type DispatchDeps } from "./dispatch";
import { JSONRPC_METHOD_NOT_FOUND } from "./jsonrpc";
import type { CanvasRole, PermissionGuardDeps } from "../lib/permission-guard";

function buildDeps(roleOverride?: {
  role?: CanvasRole | null;
  canvasExists?: boolean;
}): DispatchDeps {
  const permission: PermissionGuardDeps = {
    resolveCanvasRole: async () => ({
      canvasExists: roleOverride?.canvasExists ?? true,
      role: roleOverride?.role === undefined ? "owner" : roleOverride.role,
    }),
  };
  return {
    serverVersion: "0.7.0-test",
    toolsCallDeps: {
      permission,
      toolRegistryDeps: {
        registry: { getRoom: () => undefined } as never,
        applyMutation: (async () => ({ ok: true, appliedCount: 1 })) as never,
        sessionUserId: "user-A",
      } as never,
    },
  };
}

describe("dispatchMcpRequest", () => {
  test("initialize dispatches to handleInitialize and wraps result", async () => {
    const resp = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: "1", method: "initialize" },
      { userId: "user-A" },
      buildDeps(),
    );
    expect("result" in resp).toBe(true);
    if ("result" in resp) {
      const r = resp.result as { serverInfo: { version: string } };
      expect(r.serverInfo.version).toBe("0.7.0-test");
    }
  });

  test("ping dispatches to handlePing and returns {}", async () => {
    const resp = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { userId: "user-A" },
      buildDeps(),
    );
    expect("result" in resp).toBe(true);
    if ("result" in resp) expect(resp.result).toEqual({});
  });

  test("tools/list returns 12 tool descriptors", async () => {
    const resp = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: "1", method: "tools/list" },
      { userId: "user-A" },
      buildDeps(),
    );
    expect("result" in resp).toBe(true);
    if ("result" in resp) {
      const r = resp.result as { tools: unknown[] };
      expect(r.tools).toHaveLength(13);
    }
  });

  test("tools/call routes to handleToolsCall (createShape happy path)", async () => {
    const resp = await dispatchMcpRequest(
      {
        jsonrpc: "2.0",
        id: "1",
        method: "tools/call",
        params: {
          name: "createShape",
          arguments: {
            canvasId: "c1",
            id: "shape:abc",
            type: "geo",
            x: 0,
            y: 0,
            props: {},
          },
        },
      },
      { userId: "user-A" },
      buildDeps({ role: "owner" }),
    );
    expect("result" in resp).toBe(true);
    if ("result" in resp) {
      const r = resp.result as { content: unknown[]; isError: boolean };
      expect(r.isError).toBe(false);
      expect(r.content).toHaveLength(1);
    }
  });

  test("unknown method returns -32601 method not found", async () => {
    const resp = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: "1", method: "resources/list" },
      { userId: "user-A" },
      buildDeps(),
    );
    expect("error" in resp).toBe(true);
    if ("error" in resp) {
      expect(resp.error.code).toBe(JSONRPC_METHOD_NOT_FOUND);
    }
  });

  test("preserves request id on both success and error responses", async () => {
    const r1 = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 42, method: "ping" },
      { userId: "user-A" },
      buildDeps(),
    );
    expect(r1.id).toBe(42);

    const r2 = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: "abc", method: "nope" },
      { userId: "user-A" },
      buildDeps(),
    );
    expect(r2.id).toBe("abc");
  });
});
