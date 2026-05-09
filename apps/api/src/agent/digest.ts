/**
 * digest.ts — canvas digest builder for the agent system context.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/canvas-digest/spec.md
 *
 * Design ref:
 *   openspec/changes/add-agent-runtime-streaming/design.md
 *     "Canvas digest: 輕量 header + 既有 read tools 自取"
 *
 * The digest is a fixed-schema lightweight header sent once per agent
 * run. It MUST NOT include shape contents — agents retrieve detail via
 * the M12.2 read tools (`getShape`, `listShapesInViewport`, etc.).
 *
 * The builder accepts the same `MutatorReadersDeps` shape that M12.2
 * readers use so a test can share one fake registry across both layers
 * (canvas-digest spec "Builder reuses existing readers").
 */

import type { CanvasDigest, ShapeRef } from "@vellum/shared/agent-digest";
import type { Bounds, MutatorReadersDeps } from "../sync/mutator-readers";

export type { CanvasDigest, ShapeRef } from "@vellum/shared/agent-digest";

/**
 * Minimal room contract — mirrors the one M12.2 readers use internally.
 * Kept private to this module so we don't widen mutator-readers.ts'
 * public surface for an internal collaboration.
 */
interface RoomLike {
  getCurrentSnapshot(): {
    documents: Array<{ state: Record<string, unknown> }>;
  };
  getPresenceRecords(): Record<string, Record<string, unknown>>;
}

export interface DigestContext {
  canvasId: string;
  title: string;
  sessionId: string;
}

const ZERO_BOUNDS: Bounds = { x: 0, y: 0, w: 0, h: 0 };

function getRoom(deps: MutatorReadersDeps, canvasId: string): RoomLike | undefined {
  return deps.registry.getRoom(canvasId) as unknown as RoomLike | undefined;
}

function listShapeRecords(room: RoomLike): Record<string, unknown>[] {
  return room
    .getCurrentSnapshot()
    .documents.map((d) => d.state)
    .filter((r) => r["typeName"] === "shape");
}

function findPresenceForSession(
  presenceRecords: Record<string, Record<string, unknown>>,
  sessionId: string,
): Record<string, unknown> | null {
  for (const [recordId, record] of Object.entries(presenceRecords)) {
    if (
      recordId === `instance_presence:${sessionId}` ||
      recordId.endsWith(`:${sessionId}`) ||
      record["sessionId"] === sessionId
    ) {
      return record;
    }
  }
  return null;
}

function shapeCorner(record: Record<string, unknown>): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const props = (record["props"] as Record<string, unknown>) ?? {};
  return {
    x: typeof record["x"] === "number" ? (record["x"] as number) : 0,
    y: typeof record["y"] === "number" ? (record["y"] as number) : 0,
    w: typeof props["w"] === "number" ? (props["w"] as number) : 0,
    h: typeof props["h"] === "number" ? (props["h"] as number) : 0,
  };
}

function computeBounds(records: Record<string, unknown>[]): Bounds {
  if (records.length === 0) return { ...ZERO_BOUNDS };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of records) {
    const c = shapeCorner(r);
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + c.w > maxX) maxX = c.x + c.w;
    if (c.y + c.h > maxY) maxY = c.y + c.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function computeViewport(presence: Record<string, unknown> | null): Bounds {
  if (!presence) return { ...ZERO_BOUNDS };
  const camera = (presence["camera"] as { x: number; y: number; z: number }) ?? {
    x: 0,
    y: 0,
    z: 1,
  };
  const screen = (presence["screenBounds"] as Bounds) ?? { ...ZERO_BOUNDS };
  return { x: -camera.x, y: -camera.y, w: screen.w, h: screen.h };
}

function computeSelection(
  records: Record<string, unknown>[],
  presence: Record<string, unknown> | null,
): ShapeRef[] {
  if (!presence) return [];
  const ids = (presence["selectedShapeIds"] as string[]) ?? [];
  if (ids.length === 0) return [];
  return records
    .filter((r) => ids.includes(String(r["id"])))
    .map((r) => ({
      id: String(r["id"] ?? ""),
      type: String(r["type"] ?? ""),
    }));
}

function computeShapeCounts(records: Record<string, unknown>[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const type = String(r["type"] ?? "");
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Build the digest for a single agent run. Pure read — does not mutate
 * the room. Returns zero-everything when the room is missing so the
 * runtime can still start (and surface "no shapes yet" naturally).
 */
export async function buildCanvasDigest(
  deps: MutatorReadersDeps,
  ctx: DigestContext,
): Promise<CanvasDigest> {
  const room = getRoom(deps, ctx.canvasId);
  if (!room) {
    return {
      canvasId: ctx.canvasId,
      title: ctx.title,
      viewport: { ...ZERO_BOUNDS },
      selection: [],
      shapeCounts: {},
      bounds: { ...ZERO_BOUNDS },
    };
  }

  const records = listShapeRecords(room);
  const presence = findPresenceForSession(room.getPresenceRecords(), ctx.sessionId);

  return {
    canvasId: ctx.canvasId,
    title: ctx.title,
    viewport: computeViewport(presence),
    selection: computeSelection(records, presence),
    shapeCounts: computeShapeCounts(records),
    bounds: computeBounds(records),
  };
}
