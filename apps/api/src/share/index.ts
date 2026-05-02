/**
 * Sharing REST handler — `/api/canvas/:id/share/*` and
 * `/api/share/invite/:token/accept`.
 *
 * The handler is dependency-injected (see `ShareHandlerDeps`) so unit
 * tests can substitute in-memory state without spinning up Postgres or
 * Mailpit. Production wires the deps to Drizzle queries + the existing
 * `apps/api/src/email/mailpit.ts` client at `apps/api/src/index.ts`.
 *
 * Routes:
 *   GET    /api/canvas/:id/share
 *   POST   /api/canvas/:id/share/invite
 *   PATCH  /api/canvas/:id/share/members/:userId
 *   DELETE /api/canvas/:id/share/members/:userId
 *   DELETE /api/canvas/:id/share/invites/:inviteId
 *   PUT    /api/canvas/:id/share/link
 *   POST   /api/canvas/:id/share/link/rotate
 *   GET    /api/share/invite/:token/accept
 *
 * Spec: sharing capability (12 requirements)
 */

import type { RateLimiter } from "../lib/rate-limiter";
import { SHARE_INVITE_RULE, SHARE_LINK_ROTATE_RULE } from "../lib/rate-limit-rules";
import { generateInviteToken, computeInviteExpiresAt } from "./invite-token";
import { generateLinkToken } from "./link-token";

// ---------------------------------------------------------------------------
// Domain types — exported for the deps interface and for the test harness.
// ---------------------------------------------------------------------------

export type ShareRole = "editor" | "viewer";
export type LinkMode = "closed" | "view" | "edit";

export interface ShareRecord {
  canvasId: string;
  userId: string;
  role: ShareRole;
  createdAt: Date;
}

export interface InviteRecord {
  id: string;
  canvasId: string;
  email: string;
  role: ShareRole;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface LinkRecord {
  canvasId: string;
  token: string;
  mode: LinkMode;
  createdAt: Date;
  rotatedAt: Date;
}

export type ShareRevokeScope =
  | { kind: "user"; userId: string }
  | { kind: "all-anonymous" }
  | { kind: "all" };

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

export interface ShareHandlerDeps {
  rateLimiter: RateLimiter;
  // Canvas + user lookups
  loadCanvas(canvasId: string): Promise<{ id: string; ownerId: string; title: string } | null>;
  findUserByEmail(email: string): Promise<{ id: string; email: string; name: string } | null>;
  loadUser(userId: string): Promise<{ id: string; email: string; name: string } | null>;
  // Share rows
  listShares(canvasId: string): Promise<ShareRecord[]>;
  loadShare(canvasId: string, userId: string): Promise<ShareRecord | null>;
  upsertShare(record: ShareRecord): Promise<void>;
  deleteShare(canvasId: string, userId: string): Promise<void>;
  // Invite rows
  listInvites(canvasId: string): Promise<InviteRecord[]>;
  loadInvite(inviteId: string): Promise<InviteRecord | null>;
  findInviteByCanvasAndEmail(canvasId: string, email: string): Promise<InviteRecord | null>;
  findInviteByToken(token: string): Promise<InviteRecord | null>;
  createInvite(record: InviteRecord): Promise<void>;
  deleteInvite(inviteId: string): Promise<void>;
  // Public-link row (one per canvas)
  loadLink(canvasId: string): Promise<LinkRecord | null>;
  upsertLink(record: LinkRecord): Promise<void>;
  // Side-effects
  sendInviteEmail(args: {
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    token: string;
  }): Promise<void>;
  notifyAccessRevoked(canvasId: string, scope: ShareRevokeScope): void;
  now(): Date;
}

interface SessionLike {
  userId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHARE_PREFIX = "/api/canvas/";
const ACCEPT_PREFIX = "/api/share/invite/";

function err(status: number, error: string, extra?: object): Response {
  return Response.json({ error, ...extra }, { status });
}

function rateLimited(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "errors.rateLimit", retryAfter: retryAfterSeconds }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}

function rlKey(action: string, userId: string): string {
  return `api:share:${action}:${userId}`;
}

function isValidRole(value: unknown): value is ShareRole {
  return value === "editor" || value === "viewer";
}

function isValidMode(value: unknown): value is LinkMode {
  return value === "closed" || value === "view" || value === "edit";
}

function shareToDto(record: ShareRecord, user?: { id: string; email: string; name: string } | null) {
  return {
    canvasId: record.canvasId,
    userId: record.userId,
    role: record.role,
    createdAt: record.createdAt.toISOString(),
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
  };
}

function inviteToDto(record: InviteRecord) {
  return {
    id: record.id,
    canvasId: record.canvasId,
    email: record.email,
    role: record.role,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

function linkToDto(record: LinkRecord) {
  return {
    canvasId: record.canvasId,
    token: record.token,
    mode: record.mode,
    createdAt: record.createdAt.toISOString(),
    rotatedAt: record.rotatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function requireOwner(
  canvasId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<{ kind: "ok"; canvas: { id: string; ownerId: string; title: string } } | { kind: "err"; resp: Response }> {
  const canvas = await deps.loadCanvas(canvasId);
  if (!canvas) return { kind: "err", resp: err(404, "errors.canvas.notFound") };
  if (canvas.ownerId !== session.userId)
    return { kind: "err", resp: err(403, "errors.canvas.forbidden") };
  return { kind: "ok", canvas };
}

async function handleGetShare(
  canvasId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;
  const [members, invites, link] = await Promise.all([
    deps.listShares(canvasId),
    deps.listInvites(canvasId),
    deps.loadLink(canvasId),
  ]);
  // Hydrate member display data from the users table.
  const userMap = new Map<string, { id: string; email: string; name: string }>();
  await Promise.all(
    members.map(async (m) => {
      const u = await deps.loadUser(m.userId);
      if (u) userMap.set(m.userId, u);
    }),
  );
  return Response.json({
    data: {
      ownerId: guard.canvas.ownerId,
      members: members.map((m) => shareToDto(m, userMap.get(m.userId) ?? null)),
      invites: invites.map(inviteToDto),
      link: link ? linkToDto(link) : null,
    },
  });
}

async function handleInvite(
  req: Request,
  canvasId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const rl = deps.rateLimiter.limit(rlKey("invite", session.userId), SHARE_INVITE_RULE);
  if (!rl.allowed) return rateLimited(rl.retryAfterSeconds);

  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;

  let body: { email?: unknown; role?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; role?: unknown };
  } catch {
    return err(400, "errors.validation");
  }
  if (typeof body.email !== "string" || body.email.length === 0)
    return err(400, "errors.validation");
  if (!isValidRole(body.role)) return err(400, "errors.share.roleInvalid");
  const email = body.email.toLowerCase();
  const role = body.role;

  // 1. Existing user → upsert canvas_shares directly.
  const existing = await deps.findUserByEmail(email);
  if (existing) {
    await deps.upsertShare({
      canvasId,
      userId: existing.id,
      role,
      createdAt: deps.now(),
    });
    return Response.json({
      data: { kind: "member", userId: existing.id, role },
    });
  }

  // 2. Unknown email → upsert canvas_invites + send email.
  const previous = await deps.findInviteByCanvasAndEmail(canvasId, email);
  if (previous) await deps.deleteInvite(previous.id);
  const inviteId = crypto.randomUUID();
  const token = generateInviteToken();
  const now = deps.now();
  const invite: InviteRecord = {
    id: inviteId,
    canvasId,
    email,
    role,
    token,
    expiresAt: computeInviteExpiresAt(now),
    createdAt: now,
  };
  await deps.createInvite(invite);
  // Render + send the invite email. Body details are owned by the email
  // template; the handler only carries the data fields.
  const inviter = await deps.loadUser(session.userId);
  await deps.sendInviteEmail({
    to: email,
    subject: `${inviter?.name ?? "Someone"} invited you to "${guard.canvas.title}" on Vellum`,
    bodyHtml: "", // production wiring (3.9) renders via renderShareInviteEmail
    bodyText: "",
    token,
  });
  return Response.json({
    data: { kind: "pending", inviteId, email, role },
  });
}

async function handlePatchMember(
  req: Request,
  canvasId: string,
  userId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;
  let body: { role?: unknown };
  try {
    body = (await req.json()) as { role?: unknown };
  } catch {
    return err(400, "errors.validation");
  }
  if (!isValidRole(body.role)) return err(400, "errors.share.roleInvalid");
  const existing = await deps.loadShare(canvasId, userId);
  if (!existing) return err(404, "errors.canvas.notFound");
  await deps.upsertShare({ ...existing, role: body.role });
  deps.notifyAccessRevoked(canvasId, { kind: "user", userId });
  return Response.json({ data: { canvasId, userId, role: body.role } });
}

async function handleDeleteMember(
  canvasId: string,
  userId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;
  await deps.deleteShare(canvasId, userId);
  deps.notifyAccessRevoked(canvasId, { kind: "user", userId });
  return new Response(null, { status: 204 });
}

async function handleDeleteInvite(
  canvasId: string,
  inviteId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;
  const invite = await deps.loadInvite(inviteId);
  if (!invite || invite.canvasId !== canvasId) return err(404, "errors.share.inviteNotFound");
  await deps.deleteInvite(inviteId);
  return new Response(null, { status: 204 });
}

async function handlePutLink(
  req: Request,
  canvasId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;
  let body: { mode?: unknown };
  try {
    body = (await req.json()) as { mode?: unknown };
  } catch {
    return err(400, "errors.validation");
  }
  if (!isValidMode(body.mode)) return err(400, "errors.validation");
  const mode = body.mode;
  const existing = await deps.loadLink(canvasId);
  const now = deps.now();
  const record: LinkRecord = existing
    ? { ...existing, mode }
    : { canvasId, token: generateLinkToken(), mode, createdAt: now, rotatedAt: now };
  await deps.upsertLink(record);
  if (mode === "closed") {
    deps.notifyAccessRevoked(canvasId, { kind: "all-anonymous" });
  }
  return Response.json({ data: linkToDto(record) });
}

async function handleRotateLink(
  canvasId: string,
  session: SessionLike,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const rl = deps.rateLimiter.limit(rlKey("rotate", session.userId), SHARE_LINK_ROTATE_RULE);
  if (!rl.allowed) return rateLimited(rl.retryAfterSeconds);
  const guard = await requireOwner(canvasId, session, deps);
  if (guard.kind === "err") return guard.resp;
  const existing = await deps.loadLink(canvasId);
  const now = deps.now();
  const record: LinkRecord = existing
    ? { ...existing, token: generateLinkToken(), rotatedAt: now }
    : {
        canvasId,
        token: generateLinkToken(),
        mode: "closed",
        createdAt: now,
        rotatedAt: now,
      };
  await deps.upsertLink(record);
  deps.notifyAccessRevoked(canvasId, { kind: "all-anonymous" });
  return Response.json({ data: linkToDto(record) });
}

async function handleAcceptInvite(
  token: string,
  session: SessionLike | null,
  deps: ShareHandlerDeps,
  acceptUrl: string,
): Promise<Response> {
  const invite = await deps.findInviteByToken(token);
  if (!invite) return err(404, "errors.share.inviteNotFound");
  if (invite.expiresAt.getTime() <= deps.now().getTime())
    return err(404, "errors.share.inviteExpired");

  if (!session) {
    const dest = `/login?redirect=${encodeURIComponent(acceptUrl)}`;
    return new Response(null, { status: 302, headers: { location: dest } });
  }

  const user = await deps.loadUser(session.userId);
  if (!user) return err(401, "errors.auth.unauthorized");
  if (user.email.toLowerCase() !== invite.email.toLowerCase())
    return err(403, "errors.share.emailMismatch");

  await deps.upsertShare({
    canvasId: invite.canvasId,
    userId: user.id,
    role: invite.role,
    createdAt: deps.now(),
  });
  await deps.deleteInvite(invite.id);
  return new Response(null, {
    status: 302,
    headers: { location: `/canvas/${invite.canvasId}` },
  });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function handleShareRequest(
  req: Request,
  session: SessionLike | null,
  deps: ShareHandlerDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // Anonymous-accessible: invite accept route.
  if (path.startsWith(ACCEPT_PREFIX)) {
    const remainder = path.slice(ACCEPT_PREFIX.length);
    const m = remainder.match(/^([^/]+)\/accept$/);
    if (!m || method !== "GET") return null;
    return handleAcceptInvite(m[1]!, session, deps, path);
  }

  if (!path.startsWith(SHARE_PREFIX)) return null;
  const tail = path.slice(SHARE_PREFIX.length);
  const m = tail.match(/^([^/]+)\/share(?:\/(.*))?$/);
  if (!m) return null;

  if (!session) return err(401, "errors.auth.unauthorized");

  const canvasId = m[1]!;
  const sub = m[2] ?? "";

  if (sub === "" && method === "GET") {
    return handleGetShare(canvasId, session, deps);
  }
  if (sub === "invite" && method === "POST") {
    return handleInvite(req, canvasId, session, deps);
  }
  const memberMatch = sub.match(/^members\/([^/]+)$/);
  if (memberMatch && method === "PATCH") {
    return handlePatchMember(req, canvasId, memberMatch[1]!, session, deps);
  }
  if (memberMatch && method === "DELETE") {
    return handleDeleteMember(canvasId, memberMatch[1]!, session, deps);
  }
  const inviteMatch = sub.match(/^invites\/([^/]+)$/);
  if (inviteMatch && method === "DELETE") {
    return handleDeleteInvite(canvasId, inviteMatch[1]!, session, deps);
  }
  if (sub === "link" && method === "PUT") {
    return handlePutLink(req, canvasId, session, deps);
  }
  if (sub === "link/rotate" && method === "POST") {
    return handleRotateLink(canvasId, session, deps);
  }
  return null;
}
