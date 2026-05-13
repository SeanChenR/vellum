/**
 * jsonrpc.test.ts — JSON-RPC envelope helpers for the MCP server.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "Malformed JSON body returns -32700 parse error"
 *   - "Invalid JSON-RPC envelope returns -32600"
 */

import { describe, expect, test } from "bun:test";
import {
  JSONRPC_APP_ERROR,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_PARSE_ERROR,
  makeJsonRpcError,
  makeJsonRpcSuccess,
  parseJsonRpcRequest,
} from "./jsonrpc";

describe("parseJsonRpcRequest", () => {
  test("parses a valid request with all fields", () => {
    const r = parseJsonRpcRequest(
      JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping", params: {} }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.id).toBe("1");
      expect(r.request.method).toBe("ping");
      expect(r.request.params).toEqual({});
    }
  });

  test("accepts numeric id", () => {
    const r = parseJsonRpcRequest(JSON.stringify({ jsonrpc: "2.0", id: 42, method: "ping" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.id).toBe(42);
  });

  test("accepts null id (notification-style)", () => {
    const r = parseJsonRpcRequest(JSON.stringify({ jsonrpc: "2.0", id: null, method: "ping" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.id).toBeNull();
  });

  test("malformed JSON returns -32700 parse error", () => {
    const r = parseJsonRpcRequest("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.error.code).toBe(JSONRPC_PARSE_ERROR);
      expect(r.response.id).toBeNull();
    }
  });

  test("missing jsonrpc field returns -32600 invalid request", () => {
    const r = parseJsonRpcRequest(JSON.stringify({ id: "1", method: "ping" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.error.code).toBe(JSONRPC_INVALID_REQUEST);
  });

  test("wrong jsonrpc version (1.0) returns -32600 invalid request", () => {
    const r = parseJsonRpcRequest(JSON.stringify({ jsonrpc: "1.0", id: "1", method: "ping" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.error.code).toBe(JSONRPC_INVALID_REQUEST);
  });

  test("missing method field returns -32600 invalid request", () => {
    const r = parseJsonRpcRequest(JSON.stringify({ jsonrpc: "2.0", id: "1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.error.code).toBe(JSONRPC_INVALID_REQUEST);
  });

  test("empty method string returns -32600 invalid request", () => {
    const r = parseJsonRpcRequest(JSON.stringify({ jsonrpc: "2.0", id: "1", method: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.error.code).toBe(JSONRPC_INVALID_REQUEST);
  });

  test("null body returns -32600 invalid request (not -32700)", () => {
    const r = parseJsonRpcRequest("null");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.error.code).toBe(JSONRPC_INVALID_REQUEST);
  });

  test("array body returns -32600 (vellum does not support batch)", () => {
    const r = parseJsonRpcRequest("[]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.error.code).toBe(JSONRPC_INVALID_REQUEST);
  });
});

describe("makeJsonRpcSuccess", () => {
  test("wraps result in proper envelope", () => {
    expect(makeJsonRpcSuccess("1", { x: 42 })).toEqual({
      jsonrpc: "2.0",
      id: "1",
      result: { x: 42 },
    });
  });

  test("preserves null id", () => {
    expect(makeJsonRpcSuccess(null, {})).toEqual({ jsonrpc: "2.0", id: null, result: {} });
  });
});

describe("makeJsonRpcError", () => {
  test("wraps error code + message without data", () => {
    expect(makeJsonRpcError("1", JSONRPC_METHOD_NOT_FOUND, "no")).toEqual({
      jsonrpc: "2.0",
      id: "1",
      error: { code: JSONRPC_METHOD_NOT_FOUND, message: "no" },
    });
  });

  test("wraps error code + message + data when supplied", () => {
    expect(
      makeJsonRpcError("1", JSONRPC_APP_ERROR, "denied", {
        errorKey: "agent.error.permissionDenied",
      }),
    ).toEqual({
      jsonrpc: "2.0",
      id: "1",
      error: {
        code: JSONRPC_APP_ERROR,
        message: "denied",
        data: { errorKey: "agent.error.permissionDenied" },
      },
    });
  });
});
