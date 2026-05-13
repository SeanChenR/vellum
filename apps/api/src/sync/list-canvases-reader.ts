/**
 * list-canvases-reader.ts — backs the MCP server's `listCanvases` tool.
 *
 * Returns `{id, title, role}` for every canvas the user can access:
 * canvases they own (role: "owner") plus canvases shared to them
 * (role: "editor" | "viewer"). Capped at 100 entries.
 *
 * Spec ref: openspec/specs/server-mutation-bridge/spec.md
 *   "Tool registry enumerates the full agent tool surface" — listCanvases
 *   entry; openspec/specs/mcp-server/spec.md "tools/call dispatches to the
 *   existing tool-registry execute path with permission enforcement" —
 *   listCanvases bypass scenario.
 *
 * Deps are injected so the reader is unit-testable without a live db.
 */

export interface CanvasSummary {
  id: string;
  title: string;
  role: "owner" | "editor" | "viewer";
}

export type CanvasRole = CanvasSummary["role"];

export interface ListCanvasesDeps {
  /** All canvases owned by the user. */
  queryOwnedCanvases(userId: string): Promise<Array<{ id: string; title: string }>>;
  /** Canvases shared to the user with the assigned role. */
  querySharedCanvases(
    userId: string,
  ): Promise<Array<{ id: string; title: string; role: "editor" | "viewer" }>>;
}

import type { ReaderResult } from "./mutator-readers";

/**
 * Outcome of a listCanvases query — matches the `ReaderResult` shape so
 * the entry can live in the same `tool-registry` ReadEntry union as the
 * other read tools.
 */
export type ListCanvasesResult = ReaderResult<CanvasSummary[]>;

const MAX_CANVASES = 100;

export async function listCanvasesForUser(
  deps: ListCanvasesDeps,
  userId: string,
): Promise<ListCanvasesResult> {
  let owned: Array<{ id: string; title: string }>;
  let shared: Array<{ id: string; title: string; role: "editor" | "viewer" }>;
  try {
    [owned, shared] = await Promise.all([
      deps.queryOwnedCanvases(userId),
      deps.querySharedCanvases(userId),
    ]);
  } catch {
    return { ok: false, errorKey: "errors.listCanvases.queryFailed" };
  }

  const seen = new Set<string>();
  const combined: CanvasSummary[] = [];
  for (const c of owned) {
    if (combined.length >= MAX_CANVASES) break;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    combined.push({ id: c.id, title: c.title, role: "owner" });
  }
  for (const c of shared) {
    if (combined.length >= MAX_CANVASES) break;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    combined.push({ id: c.id, title: c.title, role: c.role });
  }
  return { ok: true, data: combined };
}
