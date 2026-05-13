/**
 * tool-types.ts — Agent tool surface name catalogue and registry types
 * (Phase 2, M12.2).
 *
 * Centralises the exhaustive `ToolName` union so the M13.1 agent runtime
 * (Vercel AI SDK consumer) and the server-side `tool-registry` agree on
 * the same set of names. The registry shape itself lives in
 * `apps/api/src/sync/tool-registry.ts`; this module is types-only.
 */

/** Write tools — mutate the canvas through `applyMutation`. */
export type WriteToolName =
  | "createShape"
  | "updateShape"
  | "deleteShape"
  | "groupShapes"
  | "ungroupShape"
  | "connectShapes";

/**
 * Read tools — derive plain results from `room.getCurrentSnapshot()` /
 * `room.getPresenceRecords()`. The user-scoped `listCanvases` (M15) is
 * also classified as `read`: it queries the user's accessible canvas
 * list and does not touch tldraw room state.
 */
export type ReadToolName =
  | "listShapes"
  | "listShapesInViewport"
  | "listShapesInSelection"
  | "getShape"
  | "getCanvasBounds"
  | "getViewport"
  | "listCanvases";

/** Exhaustive union of all thirteen tool names. */
export type ToolName = WriteToolName | ReadToolName;

export type ToolKind = "write" | "read";
