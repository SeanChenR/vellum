/**
 * dispatch.ts — JSON-RPC method router for the MCP server.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "Stateless Streamable HTTP endpoint accepts JSON-RPC 2.0 at POST /api/mcp"
 *
 * Maps inbound `method` strings to their handler. Unsupported methods
 * surface as JSON-RPC -32601 method-not-found. Application-level
 * failures (permission, validation, tool-internal) are returned as
 * -32000 by the individual handlers.
 *
 * Note: rate limiting is enforced by the HTTP layer (see `./index.ts`)
 * because it requires inspecting `tools/call` specifically before
 * dispatch.
 */

import {
  JSONRPC_METHOD_NOT_FOUND,
  makeJsonRpcError,
  makeJsonRpcSuccess,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./jsonrpc";
import { handleInitialize } from "./methods/initialize";
import { handlePing } from "./methods/ping";
import { handleToolsList } from "./methods/tools-list";
import { handleToolsCall, type ToolsCallDeps } from "./methods/tools-call";

export interface DispatchDeps {
  serverVersion: string;
  toolsCallDeps: ToolsCallDeps;
}

export interface DispatchSession {
  userId: string;
}

export async function dispatchMcpRequest(
  request: JsonRpcRequest,
  session: DispatchSession,
  deps: DispatchDeps,
): Promise<JsonRpcResponse> {
  const id: JsonRpcId = request.id;
  switch (request.method) {
    case "initialize":
      return makeJsonRpcSuccess(id, handleInitialize({ serverVersion: deps.serverVersion }));
    case "ping":
      return makeJsonRpcSuccess(id, handlePing());
    case "tools/list":
      return makeJsonRpcSuccess(id, handleToolsList());
    case "tools/call": {
      const outcome = await handleToolsCall(deps.toolsCallDeps, session, id, request.params);
      if (outcome.ok) return makeJsonRpcSuccess(id, outcome.result);
      return outcome.response;
    }
    default:
      return makeJsonRpcError(id, JSONRPC_METHOD_NOT_FOUND, `Method not found: ${request.method}`);
  }
}
