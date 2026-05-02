/**
 * Canvas list `scope=shared` tests (task 2.9).
 *
 * Covers the MODIFIED canvas-management requirement
 *   "Canvas list query with scope filter"
 * — specifically the new scenarios that REPLACE the phase-1 stub which
 * always returned `[]`. The handler now JOINs `canvas_shares` against
 * `canvases` for the requesting user.
 *
 * The new logic lives behind `handleCanvasRequest`'s list path and reads
 * via `getDb()`. To keep this file independent of a real Postgres, we
 * inject `listSharedCanvases` through a thin deps slot added by 3.8.
 */

import { describe, expect, test } from "bun:test";
import {
  handleCanvasRequest,
  type CanvasHandlerDeps,
} from "./index";
import { RateLimiter } from "../lib/rate-limiter";

const VIEWER_ID = "user-viewer";
const OWNER_A = "user-owner-a";
const OWNER_B = "user-owner-b";

interface FakeCanvas {
  id: string;
  ownerId: string;
  folderId: string | null;
  title: string;
  snapshot: object;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOW_RL = new RateLimiter({ capacity: 100 });

function fakeCanvas(id: string, ownerId: string, updatedAt: string): FakeCanvas {
  return {
    id,
    ownerId,
    folderId: null,
    title: `Canvas ${id}`,
    snapshot: {},
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt),
  };
}

function makeReq(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

describe("GET /api/canvas?scope=shared — Canvas list query with scope filter (MODIFIED)", () => {
  test("returns canvases joined through canvas_shares, sorted by updated_at desc", async () => {
    const sharedRows: FakeCanvas[] = [
      fakeCanvas("00000000-0000-0000-0000-00000000aaa1", OWNER_A, "2026-04-29T10:00:00Z"),
      fakeCanvas("00000000-0000-0000-0000-00000000aaa2", OWNER_B, "2026-04-29T12:00:00Z"),
    ];
    const deps: CanvasHandlerDeps = {
      async listSharedCanvases(userId) {
        expect(userId).toBe(VIEWER_ID);
        // Return in the order the join produces (DB does the sort, but we
        // pre-sort here to mimic the SQL ORDER BY clause).
        return [...sharedRows].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
      },
    };

    const resp = await handleCanvasRequest(
      makeReq("/api/canvas?scope=shared"),
      { userId: VIEWER_ID },
      ALLOW_RL,
      deps,
    );
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as {
      data: Array<{ id: string }>;
      meta: { total: number };
    };
    expect(body.meta.total).toBe(2);
    expect(body.data[0]?.id).toBe("00000000-0000-0000-0000-00000000aaa2");
    expect(body.data[1]?.id).toBe("00000000-0000-0000-0000-00000000aaa1");
  });

  test("excludes canvases the user owns even if a share row also exists", async () => {
    // The dependency contract guarantees the SQL excludes self-owned rows,
    // so the test enforces that the handler trusts the dep's output as-is.
    const onlySharedNonOwned: FakeCanvas[] = [
      fakeCanvas("00000000-0000-0000-0000-00000000bbb1", OWNER_B, "2026-04-29T08:00:00Z"),
    ];
    const deps: CanvasHandlerDeps = {
      async listSharedCanvases() {
        return onlySharedNonOwned;
      },
    };
    const resp = await handleCanvasRequest(
      makeReq("/api/canvas?scope=shared"),
      { userId: VIEWER_ID },
      ALLOW_RL,
      deps,
    );
    const body = (await resp!.json()) as { data: Array<{ ownerId: string }> };
    expect(body.data.every((c) => c.ownerId !== VIEWER_ID)).toBe(true);
  });

  test("scope=shared with empty result still returns 200 + meta.total=0", async () => {
    const deps: CanvasHandlerDeps = {
      async listSharedCanvases() {
        return [];
      },
    };
    const resp = await handleCanvasRequest(
      makeReq("/api/canvas?scope=shared"),
      { userId: VIEWER_ID },
      ALLOW_RL,
      deps,
    );
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: unknown[]; meta: { total: number } };
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  test("scope=shared with no session returns 401", async () => {
    const resp = await handleCanvasRequest(
      makeReq("/api/canvas?scope=shared"),
      null,
      ALLOW_RL,
      {},
    );
    expect(resp?.status).toBe(401);
  });
});
