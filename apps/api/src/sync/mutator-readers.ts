/**
 * mutator-readers.ts — snapshot-derived read tools (M12.2).
 *
 * Read functions complement the write-side `applyMutation` in
 * `./mutator.ts`. They never invoke `room.updateStore` and never modify
 * any record — they derive plain TypeScript objects from
 * `room.getCurrentSnapshot()` (shape records) and
 * `room.getPresenceRecords()` (per-session viewport + selection).
 *
 * Return shapes (`ShapeSummary` / `Bounds` / `Viewport`) are decoupled
 * from tldraw's internal record types so a tldraw schema change does
 * NOT ripple into agent prompts. If tldraw 5.x breaks something, only
 * this file changes.
 *
 * Spec ref: openspec/changes/add-full-tool-surface/specs/server-mutation-bridge/spec.md
 *   "Mutator readers expose snapshot-derived read tools without mutating the room"
 * Design ref: openspec/changes/add-full-tool-surface/design.md decisions
 *   - "讀工具走獨立 module、回 plain 物件、不 leak tldraw record"
 *   - "Viewport / Selection 從 `room.getPresenceRecords()` 衍生"
 */

import type { RoomRegistry, SyncRoomLike } from "./room";
import type { MutationErrorKey } from "./mutator";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MutatorReadersDeps {
  registry: RoomRegistry<SyncRoomLike>;
}

/**
 * Plain shape summary returned by the readers — intentionally NOT
 * tldraw's TLShape. `props` is opaque and shape-type-specific; agents
 * that need deeper introspection can call a future `getShapeProps`
 * tool.
 */
export interface ShapeSummary {
  id: string;
  type: string;
  x: number;
  y: number;
  /** null when the shape has no explicit width prop. */
  w: number | null;
  /** null when the shape has no explicit height prop. */
  h: number | null;
  parentId: string;
  rotation: number;
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Viewport is a Bounds aliased for clarity at call sites. */
export type Viewport = Bounds;

export type ReaderResult<T> = { ok: true; data: T } | { ok: false; errorKey: MutationErrorKey };

// ---------------------------------------------------------------------------
// Internal — minimal room contract we read through
// ---------------------------------------------------------------------------

interface RoomLike {
  getCurrentSnapshot(): {
    documents: Array<{ state: Record<string, unknown> }>;
  };
  getPresenceRecords(): Record<string, Record<string, unknown>>;
}

function getRoom(deps: MutatorReadersDeps, canvasId: string): RoomLike | undefined {
  return deps.registry.getRoom(canvasId) as unknown as RoomLike | undefined;
}

function isShape(record: Record<string, unknown>): boolean {
  return record["typeName"] === "shape";
}

function toSummary(record: Record<string, unknown>): ShapeSummary {
  const props = (record["props"] as Record<string, unknown>) ?? {};
  const w = typeof props["w"] === "number" ? (props["w"] as number) : null;
  const h = typeof props["h"] === "number" ? (props["h"] as number) : null;
  return {
    id: String(record["id"] ?? ""),
    type: String(record["type"] ?? ""),
    x: typeof record["x"] === "number" ? (record["x"] as number) : 0,
    y: typeof record["y"] === "number" ? (record["y"] as number) : 0,
    w,
    h,
    parentId: String(record["parentId"] ?? ""),
    rotation: typeof record["rotation"] === "number" ? (record["rotation"] as number) : 0,
    meta: (record["meta"] as Record<string, unknown>) ?? {},
    props,
  };
}

function shapeBounds(s: ShapeSummary): Bounds {
  return { x: s.x, y: s.y, w: s.w ?? 0, h: s.h ?? 0 };
}

function rectsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function isFiniteNonNeg(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function findPresenceForSession(
  presenceRecords: Record<string, Record<string, unknown>>,
  sessionId: string,
): Record<string, unknown> | null {
  // Presence records are keyed by `instance_presence:<sessionId>` in
  // tldraw 4.x, but we tolerate variants by checking suffix match on the
  // record id.
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

function listShapeRecords(room: RoomLike): Record<string, unknown>[] {
  return room
    .getCurrentSnapshot()
    .documents.map((d) => d.state)
    .filter(isShape);
}

// ---------------------------------------------------------------------------
// Public readers
// ---------------------------------------------------------------------------

export async function getShape(
  deps: MutatorReadersDeps,
  canvasId: string,
  shapeId: string,
): Promise<ReaderResult<ShapeSummary | null>> {
  const room = getRoom(deps, canvasId);
  if (!room) return { ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" };

  const records = listShapeRecords(room);
  const found = records.find((r) => r["id"] === shapeId);
  return { ok: true, data: found ? toSummary(found) : null };
}

export async function listShapesInViewport(
  deps: MutatorReadersDeps,
  canvasId: string,
  viewport: Bounds,
): Promise<ReaderResult<ShapeSummary[]>> {
  if (
    !isFiniteNonNeg(viewport.w) ||
    !isFiniteNonNeg(viewport.h) ||
    !Number.isFinite(viewport.x) ||
    !Number.isFinite(viewport.y)
  ) {
    return { ok: false, errorKey: "errors.fullToolSurface.invalidViewport" };
  }

  const room = getRoom(deps, canvasId);
  if (!room) return { ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" };

  const summaries = listShapeRecords(room).map(toSummary);
  const inside = summaries.filter((s) => rectsIntersect(shapeBounds(s), viewport));
  return { ok: true, data: inside };
}

export async function listShapesInSelection(
  deps: MutatorReadersDeps,
  canvasId: string,
  sessionId: string,
): Promise<ReaderResult<ShapeSummary[]>> {
  const room = getRoom(deps, canvasId);
  if (!room) return { ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" };

  const presence = findPresenceForSession(room.getPresenceRecords(), sessionId);
  if (!presence) return { ok: false, errorKey: "errors.fullToolSurface.sessionNotFound" };

  const selected = (presence["selectedShapeIds"] as string[]) ?? [];
  if (selected.length === 0) return { ok: true, data: [] };

  const records = listShapeRecords(room);
  const summaries = records.filter((r) => selected.includes(String(r["id"]))).map(toSummary);
  return { ok: true, data: summaries };
}

export async function getCanvasBounds(
  deps: MutatorReadersDeps,
  canvasId: string,
): Promise<ReaderResult<Bounds | null>> {
  const room = getRoom(deps, canvasId);
  if (!room) return { ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" };

  const summaries = listShapeRecords(room).map(toSummary);
  if (summaries.length === 0) return { ok: true, data: null };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of summaries) {
    const b = shapeBounds(s);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return {
    ok: true,
    data: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

export async function getViewport(
  deps: MutatorReadersDeps,
  canvasId: string,
  sessionId: string,
): Promise<ReaderResult<Viewport | null>> {
  const room = getRoom(deps, canvasId);
  if (!room) return { ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" };

  const presence = findPresenceForSession(room.getPresenceRecords(), sessionId);
  if (!presence) return { ok: false, errorKey: "errors.fullToolSurface.sessionNotFound" };

  const camera = (presence["camera"] as { x: number; y: number; z: number }) ?? {
    x: 0,
    y: 0,
    z: 1,
  };
  const screen = (presence["screenBounds"] as Bounds) ?? { x: 0, y: 0, w: 0, h: 0 };

  // Convert camera + screen to a world-coordinate viewport.
  // tldraw's camera offset is the world-coord origin shown at the
  // top-left of the screen, so the visible world rectangle's origin is
  // the negation of camera offset.
  return {
    ok: true,
    data: {
      x: -camera.x,
      y: -camera.y,
      w: screen.w,
      h: screen.h,
    },
  };
}
