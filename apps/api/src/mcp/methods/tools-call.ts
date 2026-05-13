/**
 * methods/tools-call.ts — MCP `tools/call` handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "tools/call dispatches to the existing tool-registry execute path
 *    with permission enforcement"
 *
 * Flow:
 *   1. Resolve tool entry from registry; unknown → -32000 toolUnknown
 *   2. If tool is `listCanvases`: skip canvas permission check; the
 *      tool itself queries by user id.
 *   3. Otherwise: extract `canvasId` from arguments; if missing →
 *      invalidArgs. Run `requireRole` with the appropriate role set
 *      (write tools: owner|editor; read tools: owner|editor|viewer).
 *      Any failure → invalidRequest (NEVER distinguishes "no role" vs
 *      "canvas missing" to avoid existence leak).
 *   4. Validate arguments against the registry entry's Zod schema;
 *      failure → invalidArgs.
 *   5. Dispatch `entry.execute(deps, canvasId, parsed)`; wrap success
 *      in MCP content `{content: [{type: "text", text: <stringified
 *      result>}], isError: false}`. Mutator-thrown errors map to
 *      -32000 + their errorKey.
 */

import { JSONRPC_APP_ERROR, makeJsonRpcError, type JsonRpcErrorResponse } from "../jsonrpc";
import type { ToolEntry, ToolRegistryDeps } from "../../sync/tool-registry";
import { toolRegistry } from "../../sync/tool-registry";
import type { PermissionGuardDeps, CanvasRole } from "../../lib/permission-guard";
import { requireRole } from "../../lib/permission-guard";
import type { JsonRpcId } from "../jsonrpc";

const WRITE_ROLES: ReadonlyArray<CanvasRole> = ["owner", "editor"];
const READ_ROLES: ReadonlyArray<CanvasRole> = ["owner", "editor", "viewer"];

export interface ToolsCallSession {
  userId: string;
}

export interface ToolsCallDeps {
  toolRegistryDeps: ToolRegistryDeps;
  permission: PermissionGuardDeps;
}

export interface McpContentBlock {
  type: "text";
  text: string;
}

export interface ToolsCallSuccess {
  content: McpContentBlock[];
  isError: false;
}

export type ToolsCallOutcome =
  | { ok: true; result: ToolsCallSuccess }
  | { ok: false; response: JsonRpcErrorResponse };

/**
 * Execute a single tool through the shared registry, enforcing permission.
 *
 * `params` is the raw `tools/call` JSON-RPC params: `{name, arguments}`.
 * `id` is the JSON-RPC request id propagated into the error envelope on
 * failure (success is returned to the caller to wrap, so id is not used
 * in the happy path).
 */
export async function handleToolsCall(
  deps: ToolsCallDeps,
  session: ToolsCallSession,
  id: JsonRpcId,
  params: unknown,
): Promise<ToolsCallOutcome> {
  // 1. Validate params shape.
  if (!params || typeof params !== "object") {
    return appErr(id, "agent.tool.invalidArgs");
  }
  const p = params as { name?: unknown; arguments?: unknown };
  if (typeof p.name !== "string" || p.name.length === 0) {
    return appErr(id, "agent.tool.invalidArgs");
  }
  const toolName = p.name;
  const args = (p.arguments ?? {}) as Record<string, unknown>;

  // 2. Resolve tool entry.
  const entry = (toolRegistry as Record<string, ToolEntry | undefined>)[toolName];
  if (!entry) {
    return appErr(id, "agent.tool.unknown");
  }

  // 3. Permission check (listCanvases bypasses canvas-level check).
  let canvasId = "";
  if (entry.name !== "listCanvases") {
    const rawCanvasId = args["canvasId"];
    if (typeof rawCanvasId !== "string" || rawCanvasId.length === 0) {
      return appErr(id, "agent.error.invalidRequest");
    }
    canvasId = rawCanvasId;
    const allowed = entry.kind === "write" ? WRITE_ROLES : READ_ROLES;
    const guard = await requireRole(deps.permission, { userId: session.userId }, canvasId, allowed);
    if (!guard.ok) {
      // Collapse 401 / 403 / 404 into a single application errorKey so
      // canvas existence is not leaked through differential responses.
      return appErr(id, "agent.error.invalidRequest");
    }
  }

  // 4. Validate arguments against the Zod schema.
  //
  // The tool-registry schemas were authored for the in-process agent
  // runtime, which knows `canvasId` out-of-band (the run is bound to
  // one canvas). So they do NOT include `canvasId` and many of them
  // are `.strict()` — passing the LLM-supplied `canvasId` straight
  // through would fail with "unrecognized key". Strip it before
  // validation; we already captured it above and pass it as the
  // canvasId argument to `entry.execute`.
  const { canvasId: _droppedForSchema, ...argsWithoutCanvasId } = args;
  void _droppedForSchema;
  const parsed = entry.schema.safeParse(argsWithoutCanvasId);
  if (!parsed.success) {
    return appErr(id, "agent.tool.invalidArgs");
  }

  // 5. Dispatch through the shared execute path.
  // Inject the per-request userId into toolRegistryDeps so `listCanvases`
  // (which ignores canvasId and queries by user) sees the authenticated
  // identity. Clone so concurrent requests don't trample shared state.
  const effectiveToolRegistryDeps = {
    ...deps.toolRegistryDeps,
    sessionUserId: session.userId,
  };
  let result: unknown;
  try {
    // The polymorphic union over ToolEntry is widened to its intersection
    // at this call site — cast is safe because we've narrowed by name
    // and validated args through the matching schema.
    result = await (
      entry.execute as (d: ToolRegistryDeps, c: string, i: unknown) => Promise<unknown>
    )(effectiveToolRegistryDeps, canvasId, parsed.data);
  } catch (err) {
    const errorKey = errorKeyFromThrown(err);
    return appErr(id, errorKey);
  }

  // 6. Surface tool-internal failure (read tools that return
  //    {ok: false, errorKey}) as a JSON-RPC error too. Write tools
  //    likewise — applyMutation returns {ok: false} on validation /
  //    canvas-not-in-active-room.
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok: boolean }).ok === false
  ) {
    const errorKey = (result as { errorKey?: string }).errorKey ?? "agent.error.internal";
    return appErr(id, errorKey);
  }

  return {
    ok: true,
    result: {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appErr(id: JsonRpcId, errorKey: string): ToolsCallOutcome {
  return {
    ok: false,
    response: makeJsonRpcError(id, JSONRPC_APP_ERROR, "Application error", { errorKey }),
  };
}

function errorKeyFromThrown(err: unknown): string {
  if (err instanceof Error && err.message.startsWith("errors.")) {
    return err.message;
  }
  return "agent.error.internal";
}
