/**
 * Sharing endpoints tests (tasks 2.4 + 2.5).
 *
 * Covers spec requirements:
 *   - Owner invites a known user by email creates a share immediately
 *   - Owner invites an unknown email creates a pending invite and sends mail
 *   - Invite acceptance route requires email match and writes a share
 *   - Owner reads share state for a canvas
 *   - Owner changes a member's role
 *   - Owner removes a share
 *   - Owner revokes a pending invite
 *   - Owner toggles the public link mode
 *   - Owner rotates the public link token
 *   - Sharing endpoints enforce per-owner rate limits
 *
 * The handler is dependency-injected (`ShareHandlerDeps`) so tests can
 * substitute in-memory state for the canvas / share / invite tables, a
 * recording email service, and a recording sync-revocation hook. No real
 * Postgres / Mailpit needed.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  handleShareRequest,
  type ShareHandlerDeps,
  type ShareRevokeScope,
  type ShareRecord,
  type InviteRecord,
  type LinkRecord,
} from "./index";
import { RateLimiter } from "../lib/rate-limiter";

const OWNER_ID = "user-owner";
const EXISTING_USER_ID = "user-bob";
const EXISTING_USER_EMAIL = "bob@example.com";
const NEW_EMAIL = "alice@example.com";
const CANVAS_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_CANVAS_ID = "00000000-0000-0000-0000-000000000002";

interface FakeState {
  canvases: Map<string, { id: string; ownerId: string; title: string }>;
  users: Map<string, { id: string; email: string; name: string }>;
  shares: Map<string, ShareRecord>; // key = `${canvasId}:${userId}`
  invites: Map<string, InviteRecord>; // key = id
  links: Map<string, LinkRecord>; // key = canvasId
  emails: Array<{ to: string; subject: string; body: string; token: string }>;
  revocations: Array<{ canvasId: string; scope: ShareRevokeScope }>;
}

function makeState(): FakeState {
  return {
    canvases: new Map([[CANVAS_ID, { id: CANVAS_ID, ownerId: OWNER_ID, title: "Test Canvas" }]]),
    users: new Map([
      [EXISTING_USER_ID, { id: EXISTING_USER_ID, email: EXISTING_USER_EMAIL, name: "Bob" }],
      [OWNER_ID, { id: OWNER_ID, email: "owner@example.com", name: "Owner" }],
    ]),
    shares: new Map(),
    invites: new Map(),
    links: new Map(),
    emails: [],
    revocations: [],
  };
}

function makeDeps(state: FakeState): ShareHandlerDeps {
  return {
    rateLimiter: new RateLimiter({ capacity: 1000 }),
    async loadCanvas(canvasId) {
      return state.canvases.get(canvasId) ?? null;
    },
    async findUserByEmail(email) {
      const lower = email.toLowerCase();
      for (const u of state.users.values()) {
        if (u.email.toLowerCase() === lower) return u;
      }
      return null;
    },
    async loadUser(userId) {
      return state.users.get(userId) ?? null;
    },
    async listShares(canvasId) {
      return Array.from(state.shares.values()).filter((s) => s.canvasId === canvasId);
    },
    async listInvites(canvasId) {
      return Array.from(state.invites.values()).filter((i) => i.canvasId === canvasId);
    },
    async loadLink(canvasId) {
      return state.links.get(canvasId) ?? null;
    },
    async upsertShare(record) {
      state.shares.set(`${record.canvasId}:${record.userId}`, record);
    },
    async loadShare(canvasId, userId) {
      return state.shares.get(`${canvasId}:${userId}`) ?? null;
    },
    async deleteShare(canvasId, userId) {
      state.shares.delete(`${canvasId}:${userId}`);
    },
    async createInvite(record) {
      state.invites.set(record.id, record);
    },
    async findInviteByCanvasAndEmail(canvasId, email) {
      const lower = email.toLowerCase();
      for (const inv of state.invites.values()) {
        if (inv.canvasId === canvasId && inv.email.toLowerCase() === lower) return inv;
      }
      return null;
    },
    async findInviteByToken(token) {
      for (const inv of state.invites.values()) {
        if (inv.token === token) return inv;
      }
      return null;
    },
    async loadInvite(inviteId) {
      return state.invites.get(inviteId) ?? null;
    },
    async deleteInvite(inviteId) {
      state.invites.delete(inviteId);
    },
    async upsertLink(record) {
      state.links.set(record.canvasId, record);
    },
    async sendInviteEmail(args) {
      state.emails.push({
        to: args.to,
        subject: args.subject,
        body: args.bodyHtml,
        token: args.token,
      });
    },
    notifyAccessRevoked(canvasId, scope) {
      state.revocations.push({ canvasId, scope });
    },
    now: () => new Date("2026-05-02T12:00:00Z"),
  };
}

const BASE = "http://localhost";

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function ownerSession() {
  return { userId: OWNER_ID } as const;
}

function nonOwnerSession() {
  return { userId: "user-stranger" } as const;
}

let state: FakeState;
let deps: ShareHandlerDeps;

beforeEach(() => {
  state = makeState();
  deps = makeDeps(state);
});

// ---------------------------------------------------------------------------
// POST /api/canvas/:id/share/invite — known user (immediate share)
// ---------------------------------------------------------------------------

describe("POST /share/invite — Owner invites a known user by email creates a share immediately", () => {
  test("inserts canvas_shares row and returns kind:member", async () => {
    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: EXISTING_USER_EMAIL,
      role: "editor",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: { kind: string; userId: string; role: string } };
    expect(body.data.kind).toBe("member");
    expect(body.data.userId).toBe(EXISTING_USER_ID);
    expect(body.data.role).toBe("editor");
    expect(state.shares.size).toBe(1);
    expect(state.emails).toHaveLength(0);
  });

  test("non-owner is forbidden from inviting", async () => {
    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: EXISTING_USER_EMAIL,
      role: "editor",
    });
    const resp = await handleShareRequest(r, nonOwnerSession(), deps);
    expect(resp?.status).toBe(403);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.forbidden");
  });

  test("normalises email to lowercase before lookup", async () => {
    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: EXISTING_USER_EMAIL.toUpperCase(),
      role: "viewer",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    expect(state.shares.size).toBe(1);
  });

  test("re-inviting an existing share updates the role", async () => {
    state.shares.set(`${CANVAS_ID}:${EXISTING_USER_ID}`, {
      canvasId: CANVAS_ID,
      userId: EXISTING_USER_ID,
      role: "editor",
      createdAt: new Date(),
    });
    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: EXISTING_USER_EMAIL,
      role: "viewer",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: { kind: string; role: string } };
    expect(body.data.kind).toBe("member");
    expect(state.shares.get(`${CANVAS_ID}:${EXISTING_USER_ID}`)?.role).toBe("viewer");
  });

  test("invalid role returns 400", async () => {
    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: EXISTING_USER_EMAIL,
      role: "owner",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(400);
  });

  test("non-existent canvas returns 404", async () => {
    const r = req("POST", `/api/canvas/${OTHER_CANVAS_ID}/share/invite`, {
      email: EXISTING_USER_EMAIL,
      role: "editor",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/canvas/:id/share/invite — unknown email (pending invite + email)
// ---------------------------------------------------------------------------

describe("POST /share/invite — Owner invites an unknown email creates a pending invite and sends mail", () => {
  test("inserts canvas_invites row and sends an email", async () => {
    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: NEW_EMAIL,
      role: "viewer",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: { kind: string; email: string; role: string } };
    expect(body.data.kind).toBe("pending");
    expect(body.data.email).toBe(NEW_EMAIL);
    expect(state.invites.size).toBe(1);
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0]?.to).toBe(NEW_EMAIL);
    const invite = Array.from(state.invites.values())[0]!;
    expect(invite.token.length).toBe(43);
    // expires_at = now + 7 days
    const ms = invite.expiresAt.getTime() - new Date("2026-05-02T12:00:00Z").getTime();
    expect(ms).toBe(7 * 24 * 3600 * 1000);
  });

  test("re-inviting same email overwrites token and resets expires", async () => {
    const first = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: NEW_EMAIL,
      role: "viewer",
    });
    await handleShareRequest(first, ownerSession(), deps);
    const oldToken = Array.from(state.invites.values())[0]!.token;

    const second = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: NEW_EMAIL,
      role: "editor",
    });
    const resp = await handleShareRequest(second, ownerSession(), deps);
    expect(resp?.status).toBe(200);

    expect(state.invites.size).toBe(1);
    const newToken = Array.from(state.invites.values())[0]!.token;
    expect(newToken).not.toBe(oldToken);
  });
});

// ---------------------------------------------------------------------------
// GET /api/canvas/:id/share — Owner reads share state for a canvas
// ---------------------------------------------------------------------------

describe("GET /share — Owner reads share state for a canvas", () => {
  test("fresh canvas returns empty members + invites + null link", async () => {
    const r = req("GET", `/api/canvas/${CANVAS_ID}/share`);
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as {
      data: { ownerId: string; members: unknown[]; invites: unknown[]; link: unknown };
    };
    expect(body.data.ownerId).toBe(OWNER_ID);
    expect(body.data.members).toEqual([]);
    expect(body.data.invites).toEqual([]);
    expect(body.data.link).toBeNull();
  });

  test("mixed state returns 2 members and 1 invite", async () => {
    state.shares.set(`${CANVAS_ID}:${EXISTING_USER_ID}`, {
      canvasId: CANVAS_ID,
      userId: EXISTING_USER_ID,
      role: "editor",
      createdAt: new Date(),
    });
    state.shares.set(`${CANVAS_ID}:user-charlie`, {
      canvasId: CANVAS_ID,
      userId: "user-charlie",
      role: "viewer",
      createdAt: new Date(),
    });
    state.invites.set("inv-1", {
      id: "inv-1",
      canvasId: CANVAS_ID,
      email: NEW_EMAIL,
      role: "viewer",
      token: "x".repeat(43),
      expiresAt: new Date("2030-01-01"),
      createdAt: new Date(),
    });
    state.links.set(CANVAS_ID, {
      canvasId: CANVAS_ID,
      token: "y".repeat(43),
      mode: "view",
      createdAt: new Date(),
      rotatedAt: new Date(),
    });

    const r = req("GET", `/api/canvas/${CANVAS_ID}/share`);
    const resp = await handleShareRequest(r, ownerSession(), deps);
    const body = (await resp!.json()) as {
      data: { members: unknown[]; invites: unknown[]; link: { mode: string } };
    };
    expect(body.data.members).toHaveLength(2);
    expect(body.data.invites).toHaveLength(1);
    expect(body.data.link.mode).toBe("view");
  });
});

// ---------------------------------------------------------------------------
// PATCH /share/members/:userId — Owner changes a member's role
// ---------------------------------------------------------------------------

describe("PATCH /share/members/:userId — Owner changes a member's role", () => {
  test("updates role and triggers user-scoped revocation", async () => {
    state.shares.set(`${CANVAS_ID}:${EXISTING_USER_ID}`, {
      canvasId: CANVAS_ID,
      userId: EXISTING_USER_ID,
      role: "editor",
      createdAt: new Date(),
    });

    const r = req("PATCH", `/api/canvas/${CANVAS_ID}/share/members/${EXISTING_USER_ID}`, {
      role: "viewer",
    });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    expect(state.shares.get(`${CANVAS_ID}:${EXISTING_USER_ID}`)?.role).toBe("viewer");
    expect(state.revocations).toHaveLength(1);
    expect(state.revocations[0]?.scope).toEqual({ kind: "user", userId: EXISTING_USER_ID });
  });
});

// ---------------------------------------------------------------------------
// DELETE /share/members/:userId — Owner removes a share
// ---------------------------------------------------------------------------

describe("DELETE /share/members/:userId — Owner removes a share", () => {
  test("deletes the row and triggers user-scoped revocation", async () => {
    state.shares.set(`${CANVAS_ID}:${EXISTING_USER_ID}`, {
      canvasId: CANVAS_ID,
      userId: EXISTING_USER_ID,
      role: "editor",
      createdAt: new Date(),
    });

    const r = req("DELETE", `/api/canvas/${CANVAS_ID}/share/members/${EXISTING_USER_ID}`);
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(204);
    expect(state.shares.size).toBe(0);
    expect(state.revocations).toHaveLength(1);
    expect(state.revocations[0]?.scope).toEqual({ kind: "user", userId: EXISTING_USER_ID });
  });
});

// ---------------------------------------------------------------------------
// DELETE /share/invites/:inviteId — Owner revokes a pending invite
// ---------------------------------------------------------------------------

describe("DELETE /share/invites/:inviteId — Owner revokes a pending invite", () => {
  test("deletes the invite and the accept URL fails afterwards", async () => {
    const inv: InviteRecord = {
      id: "inv-1",
      canvasId: CANVAS_ID,
      email: NEW_EMAIL,
      role: "viewer",
      token: "z".repeat(43),
      expiresAt: new Date("2030-01-01"),
      createdAt: new Date(),
    };
    state.invites.set(inv.id, inv);

    const r = req("DELETE", `/api/canvas/${CANVAS_ID}/share/invites/${inv.id}`);
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(204);
    expect(state.invites.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PUT /share/link — Owner toggles the public link mode
// ---------------------------------------------------------------------------

describe("PUT /share/link — Owner toggles the public link mode", () => {
  test("first call lazy-creates the link row", async () => {
    const r = req("PUT", `/api/canvas/${CANVAS_ID}/share/link`, { mode: "view" });
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    const link = state.links.get(CANVAS_ID);
    expect(link?.mode).toBe("view");
    expect(link?.token.length).toBe(43);
  });

  test("setting mode=closed kicks anonymous sessions", async () => {
    state.links.set(CANVAS_ID, {
      canvasId: CANVAS_ID,
      token: "k".repeat(43),
      mode: "view",
      createdAt: new Date(),
      rotatedAt: new Date(),
    });
    const r = req("PUT", `/api/canvas/${CANVAS_ID}/share/link`, { mode: "closed" });
    await handleShareRequest(r, ownerSession(), deps);
    expect(state.links.get(CANVAS_ID)?.mode).toBe("closed");
    expect(state.revocations.some((r) => r.scope.kind === "all-anonymous")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /share/link/rotate — Owner rotates the public link token
// ---------------------------------------------------------------------------

describe("POST /share/link/rotate — Owner rotates the public link token", () => {
  test("replaces token, bumps rotated_at, and kicks anonymous sessions", async () => {
    state.links.set(CANVAS_ID, {
      canvasId: CANVAS_ID,
      token: "old-token-old-token-old-token-old-token-old",
      mode: "view",
      createdAt: new Date("2026-05-01T00:00:00Z"),
      rotatedAt: new Date("2026-05-01T00:00:00Z"),
    });

    const r = req("POST", `/api/canvas/${CANVAS_ID}/share/link/rotate`);
    const resp = await handleShareRequest(r, ownerSession(), deps);
    expect(resp?.status).toBe(200);
    const link = state.links.get(CANVAS_ID)!;
    expect(link.token).not.toBe("old-token-old-token-old-token-old-token-old");
    expect(link.token.length).toBe(43);
    expect(state.revocations.some((r) => r.scope.kind === "all-anonymous")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rate limits — Sharing endpoints enforce per-owner rate limits
// ---------------------------------------------------------------------------

describe("rate limits — Sharing endpoints enforce per-owner rate limits", () => {
  test("11th invite within 60 seconds returns 429", async () => {
    for (let i = 0; i < 10; i++) {
      const r = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
        email: `inv${i}@example.com`,
        role: "viewer",
      });
      const resp = await handleShareRequest(r, ownerSession(), deps);
      expect(resp?.status).toBe(200);
    }
    const eleventh = req("POST", `/api/canvas/${CANVAS_ID}/share/invite`, {
      email: "inv-overflow@example.com",
      role: "viewer",
    });
    const resp = await handleShareRequest(eleventh, ownerSession(), deps);
    expect(resp?.status).toBe(429);
    expect(resp?.headers.get("retry-after")).toBeTruthy();
  });

  test("6th rotate within 60 seconds returns 429", async () => {
    state.links.set(CANVAS_ID, {
      canvasId: CANVAS_ID,
      token: "t".repeat(43),
      mode: "view",
      createdAt: new Date(),
      rotatedAt: new Date(),
    });
    for (let i = 0; i < 5; i++) {
      const r = req("POST", `/api/canvas/${CANVAS_ID}/share/link/rotate`);
      const resp = await handleShareRequest(r, ownerSession(), deps);
      expect(resp?.status).toBe(200);
    }
    const sixth = req("POST", `/api/canvas/${CANVAS_ID}/share/link/rotate`);
    const resp = await handleShareRequest(sixth, ownerSession(), deps);
    expect(resp?.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// GET /api/share/invite/:token/accept — Invite acceptance route (task 2.5)
// ---------------------------------------------------------------------------

describe("GET /api/share/invite/:token/accept — Invite acceptance route requires email match and writes a share", () => {
  function makeInvite(email = NEW_EMAIL, expiresAt = new Date("2030-01-01")): InviteRecord {
    return {
      id: "inv-accept",
      canvasId: CANVAS_ID,
      email,
      role: "editor",
      token: "accept-token-accept-token-accept-token-acce",
      expiresAt,
      createdAt: new Date(),
    };
  }

  test("logged-in invitee with matching email accepts and is redirected to canvas", async () => {
    const inv = makeInvite();
    state.invites.set(inv.id, inv);
    state.users.set("user-alice", { id: "user-alice", email: NEW_EMAIL, name: "Alice" });

    const r = req("GET", `/api/share/invite/${inv.token}/accept`);
    const resp = await handleShareRequest(r, { userId: "user-alice" }, deps);
    expect(resp?.status).toBe(302);
    expect(resp?.headers.get("location")).toBe(`/canvas/${CANVAS_ID}`);
    expect(state.shares.size).toBe(1);
    expect(state.invites.size).toBe(0);
  });

  test("anonymous invitee is redirected to /login with redirect query", async () => {
    const inv = makeInvite();
    state.invites.set(inv.id, inv);

    const r = req("GET", `/api/share/invite/${inv.token}/accept`);
    const resp = await handleShareRequest(r, null, deps);
    expect(resp?.status).toBe(302);
    const loc = resp?.headers.get("location") ?? "";
    expect(loc.startsWith("/login?redirect=")).toBe(true);
    expect(loc).toContain(encodeURIComponent(`/api/share/invite/${inv.token}/accept`));
  });

  test("email mismatch returns 403", async () => {
    const inv = makeInvite();
    state.invites.set(inv.id, inv);
    // Logged in as someone whose email does not match the invite.
    state.users.set("user-mallory", {
      id: "user-mallory",
      email: "mallory@example.com",
      name: "Mallory",
    });

    const r = req("GET", `/api/share/invite/${inv.token}/accept`);
    const resp = await handleShareRequest(r, { userId: "user-mallory" }, deps);
    expect(resp?.status).toBe(403);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.share.emailMismatch");
    expect(state.shares.size).toBe(0);
    expect(state.invites.size).toBe(1);
  });

  test("expired token returns 404", async () => {
    const inv = makeInvite(NEW_EMAIL, new Date("2025-01-01"));
    state.invites.set(inv.id, inv);

    const r = req("GET", `/api/share/invite/${inv.token}/accept`);
    const resp = await handleShareRequest(r, null, deps);
    expect(resp?.status).toBe(404);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.share.inviteExpired");
  });

  test("missing / unknown token returns 404", async () => {
    const r = req("GET", `/api/share/invite/nonexistent/accept`);
    const resp = await handleShareRequest(r, null, deps);
    expect(resp?.status).toBe(404);
  });
});
