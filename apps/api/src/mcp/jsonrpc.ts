/**
 * jsonrpc.ts — JSON-RPC 2.0 envelope helpers for the MCP server.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "Stateless Streamable HTTP endpoint accepts JSON-RPC 2.0 at POST /api/mcp"
 *
 * `parseJsonRpcRequest(body)` validates the inbound shape and returns
 * either a parsed request or a JSON-RPC error envelope:
 *   - malformed JSON       → error code -32700
 *   - missing jsonrpc/method → error code -32600
 *
 * `makeJsonRpcSuccess` / `makeJsonRpcError` build the response envelope.
 */

// ---------------------------------------------------------------------------
// Standard JSON-RPC 2.0 error codes
// ---------------------------------------------------------------------------

export const JSONRPC_PARSE_ERROR = -32700;
export const JSONRPC_INVALID_REQUEST = -32600;
export const JSONRPC_METHOD_NOT_FOUND = -32601;
export const JSONRPC_INVALID_PARAMS = -32602;
export const JSONRPC_INTERNAL_ERROR = -32603;
/** Server-defined application error (e.g. permission, rate limit, validation). */
export const JSONRPC_APP_ERROR = -32000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export type ParseResult =
  | { ok: true; request: JsonRpcRequest }
  | { ok: false; response: JsonRpcErrorResponse };

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Validate a raw request body string as a JSON-RPC 2.0 request.
 *
 * Returns `{ok: true, request}` on success or `{ok: false, response}` on
 * a protocol-level failure (caller writes the response straight back).
 */
export function parseJsonRpcRequest(bodyText: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      response: makeJsonRpcError(null, JSONRPC_PARSE_ERROR, "Parse error"),
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      response: makeJsonRpcError(null, JSONRPC_INVALID_REQUEST, "Invalid Request"),
    };
  }
  const obj = raw as Record<string, unknown>;
  if (obj["jsonrpc"] !== "2.0") {
    return {
      ok: false,
      response: makeJsonRpcError(
        idFromObj(obj),
        JSONRPC_INVALID_REQUEST,
        "Invalid Request — missing or wrong `jsonrpc` field",
      ),
    };
  }
  if (typeof obj["method"] !== "string" || obj["method"].length === 0) {
    return {
      ok: false,
      response: makeJsonRpcError(
        idFromObj(obj),
        JSONRPC_INVALID_REQUEST,
        "Invalid Request — missing `method` field",
      ),
    };
  }
  const params = obj["params"];
  if (
    params !== undefined &&
    (params === null ||
      typeof params !== "object" ||
      // Array is allowed per JSON-RPC 2.0 spec; we accept it but the
      // dispatcher will refuse if a method doesn't support array params.
      false)
  ) {
    return {
      ok: false,
      response: makeJsonRpcError(
        idFromObj(obj),
        JSONRPC_INVALID_REQUEST,
        "Invalid Request — `params` must be an object or array when present",
      ),
    };
  }
  return {
    ok: true,
    request: {
      jsonrpc: "2.0",
      id: idFromObj(obj),
      method: obj["method"],
      params: params as JsonRpcRequest["params"],
    },
  };
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function makeJsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

export function makeJsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function idFromObj(obj: Record<string, unknown>): JsonRpcId {
  const id = obj["id"];
  if (typeof id === "string" || typeof id === "number" || id === null) return id;
  return null;
}
