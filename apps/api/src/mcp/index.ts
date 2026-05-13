/**
 * mcp/index.ts — HTTP-level entry point for `POST /api/mcp`.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "Stateless Streamable HTTP endpoint accepts JSON-RPC 2.0 at POST /api/mcp"
 *   - "PAT authentication gate sits in front of JSON-RPC dispatch"
 *   - "MCP_TOOL_CALL_RULE rate-limits tools/call at 60 calls per 60 seconds per user"
 *
 * Order of operations on every request:
 *   1. PAT auth — 401 if missing / invalid / expired / revoked.
 *      Body is empty; this signal lives at the HTTP layer so MCP
 *      client SDKs handle it through their standard reconnect /
 *      backoff path.
 *   2. Body parse + JSON-RPC envelope validation. Errors at this stage
 *      surface as HTTP 200 + JSON-RPC -32700 / -32600 (per spec).
 *   3. Rate limit — only on `tools/call`. 429 + Retry-After header.
 *   4. Dispatch via the method router.
 *   5. Touch last_used_at (throttled to once per 60s per token).
 */

import {
  authenticatePat,
  touchLastUsed,
  type LastUsedThrottle,
  type AuthLogger,
} from "../pat/auth";
import { MCP_TOOL_CALL_RULE } from "../lib/rate-limit-rules";
import { parseJsonRpcRequest } from "./jsonrpc";
import { dispatchMcpRequest, type DispatchDeps } from "./dispatch";
import type { PatRepo } from "../pat/repo";
import type { RateLimiter } from "../lib/rate-limiter";

export interface McpServerDeps extends DispatchDeps {
  patRepo: PatRepo;
  rateLimiter: RateLimiter;
  logger: AuthLogger;
  lastUsedThrottle: LastUsedThrottle;
  clock?: { now(): number };
}

function rlKey(userId: string): string {
  return `mcp:user:${userId}`;
}

/**
 * Handle a single `POST /api/mcp` request end-to-end. Returns a `Response`
 * ready to be sent to the MCP client.
 */
export async function handleMcpRequest(req: Request, deps: McpServerDeps): Promise<Response> {
  // 1. PAT auth.
  const auth = await authenticatePat(req, { repo: deps.patRepo, logger: deps.logger });
  if (!auth) {
    return new Response(null, { status: 401 });
  }

  // 2. Parse body.
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    bodyText = "";
  }
  const parsed = parseJsonRpcRequest(bodyText);
  if (!parsed.ok) {
    // Protocol-level errors are still HTTP 200 per JSON-RPC convention.
    return jsonResponse(200, parsed.response);
  }
  const request = parsed.request;

  // 3. Rate limit — only `tools/call` consumes the bucket.
  if (request.method === "tools/call") {
    const rl = deps.rateLimiter.limit(rlKey(auth.userId), MCP_TOOL_CALL_RULE);
    if (!rl.allowed) {
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }
  }

  // 4. Dispatch.
  const response = await dispatchMcpRequest(request, { userId: auth.userId }, deps);

  // 5. Touch last_used_at (throttled, fire-and-forget).
  const clock = deps.clock ?? { now: () => Date.now() };
  void touchLastUsed(auth.tokenId, deps.patRepo, clock, deps.lastUsedThrottle).catch(() => {
    // Throttle write failure is non-fatal for the request.
  });

  return jsonResponse(200, response);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
