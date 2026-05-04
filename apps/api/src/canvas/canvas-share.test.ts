/**
 * GET /api/canvas/:id — share / public-link access tests.
 *
 * Covers the bug fix where `handleRead` previously called `canAccess` with
 * no `ctx`, locking out shared editors / viewers and anonymous public-link
 * visitors with the misleading "找不到此畫布" UI.
 *
 * Like canvas-scope-shared.test.ts, the handler dependencies are injected
 * so the test stays Postgres-free.
 */

import { describe, expect, test } from "bun:test";
import { handleCanvasRequest, type CanvasHandlerDeps } from "./index";
import { RateLimiter } from "../lib/rate-limiter";

const ALLOW_RL = new RateLimiter({ capacity: 100 });

const OWNER_ID = "user-owner";
const SHARED_USER_ID = "user-shared";
const STRANGER_ID = "user-stranger";
const CANVAS_ID = "00000000-0000-0000-0000-000000000ca1";
const OTHER_CANVAS_ID = "00000000-0000-0000-0000-000000000ca2";

interface FakeCanvas {
  id: string;
  ownerId: string;
  folderId: string | null;
  title: string;
  snapshot: object;
  createdAt: Date;
  updatedAt: Date;
}

function fakeCanvas(id: string = CANVAS_ID, ownerId: string = OWNER_ID): FakeCanvas {
  return {
    id,
    ownerId,
    folderId: null,
    title: "Shared Canvas",
    snapshot: {},
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
  };
}

function makeReq(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

interface BuildDepsArgs {
  canvas?: FakeCanvas | null;
  shareRow?: { role: "editor" | "viewer" } | null;
  link?: { canvasId: string; mode: "closed" | "view" | "edit" } | null;
}

function buildDeps(args: BuildDepsArgs = {}): CanvasHandlerDeps {
  return {
    async loadCanvas(id) {
      if (args.canvas === null) return null;
      const c = args.canvas ?? fakeCanvas();
      return c.id === id ? c : null;
    },
    async loadCanvasShareRow(_canvasId, _userId) {
      return args.shareRow ?? null;
    },
    async resolveCanvasShareLink(_token) {
      return args.link ?? null;
    },
  };
}

describe("GET /api/canvas/:id — share row access", () => {
  test("logged-in shared editor returns 200 with canvas data", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}`),
      { userId: SHARED_USER_ID },
      ALLOW_RL,
      buildDeps({ shareRow: { role: "editor" } }),
    );
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: { id: string; ownerId: string } };
    expect(body.data.id).toBe(CANVAS_ID);
    expect(body.data.ownerId).toBe(OWNER_ID);
  });

  test("logged-in shared viewer returns 200 with canvas data", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}`),
      { userId: SHARED_USER_ID },
      ALLOW_RL,
      buildDeps({ shareRow: { role: "viewer" } }),
    );
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: { id: string } };
    expect(body.data.id).toBe(CANVAS_ID);
  });

  test("logged-in stranger with no share row and no link returns 403", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}`),
      { userId: STRANGER_ID },
      ALLOW_RL,
      buildDeps(),
    );
    expect(resp?.status).toBe(403);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.forbidden");
  });

  test("owner still passes when no share row is present", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}`),
      { userId: OWNER_ID },
      ALLOW_RL,
      buildDeps(),
    );
    expect(resp?.status).toBe(200);
  });
});

describe("GET /api/canvas/:id?share=<token> — public link access", () => {
  test("anonymous visitor with view-mode token returns 200", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-view`),
      null,
      ALLOW_RL,
      buildDeps({ link: { canvasId: CANVAS_ID, mode: "view" } }),
    );
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: { id: string } };
    expect(body.data.id).toBe(CANVAS_ID);
  });

  test("anonymous visitor with edit-mode token returns 200", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-edit`),
      null,
      ALLOW_RL,
      buildDeps({ link: { canvasId: CANVAS_ID, mode: "edit" } }),
    );
    expect(resp?.status).toBe(200);
  });

  test("anonymous visitor with closed-mode token returns 401", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-closed`),
      null,
      ALLOW_RL,
      buildDeps({ link: { canvasId: CANVAS_ID, mode: "closed" } }),
    );
    expect(resp?.status).toBe(401);
  });

  test("anonymous visitor with unknown token returns 401", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-unknown`),
      null,
      ALLOW_RL,
      buildDeps({ link: null }),
    );
    expect(resp?.status).toBe(401);
  });

  test("anonymous visitor when token resolves to a different canvasId returns 401", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-mismatch`),
      null,
      ALLOW_RL,
      buildDeps({ link: { canvasId: OTHER_CANVAS_ID, mode: "view" } }),
    );
    expect(resp?.status).toBe(401);
  });

  test("logged-in user with view-mode token can read (link wins over no share)", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-view`),
      { userId: STRANGER_ID },
      ALLOW_RL,
      buildDeps({ link: { canvasId: CANVAS_ID, mode: "view" } }),
    );
    expect(resp?.status).toBe(200);
  });

  test("anonymous visitor with token but canvas not found returns 404", async () => {
    const resp = await handleCanvasRequest(
      makeReq(`/api/canvas/${CANVAS_ID}?share=tok-view`),
      null,
      ALLOW_RL,
      buildDeps({ canvas: null, link: { canvasId: CANVAS_ID, mode: "view" } }),
    );
    expect(resp?.status).toBe(404);
  });
});
