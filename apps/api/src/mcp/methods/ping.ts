/**
 * methods/ping.ts — MCP `ping` handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "ping returns empty result for client health checks"
 *
 * Health-check method. MCP clients periodically ping the server to
 * confirm the connection is alive; the response payload is intentionally
 * empty.
 */

export function handlePing(): Record<string, never> {
  return {};
}
