# multiplayer-sync Specification

## Purpose

TBD - created by archiving change 'add-multiplayer-sync'. Update Purpose after archive.

## Requirements

### Requirement: WebSocket sync endpoint accepts upgrades at a canvas-scoped path

The system SHALL expose a single WebSocket sync endpoint at the path `/sync/:canvasId` served by the existing Bun.serve process (no separate process). The handshake SHALL be a standard HTTP Upgrade request. Upgrades SHALL only succeed after the request passes session-cookie authentication, permission check, and rate-limit checks. Any failure path SHALL return an HTTP response WITHOUT performing the WebSocket upgrade.

#### Scenario: Authenticated owner upgrades successfully

- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>` carrying a valid better-auth session cookie for a user who owns `<canvasId>`
- **THEN** the server MUST upgrade the connection to a WebSocket
- **AND** the WebSocket MUST be associated with the room for `<canvasId>`

#### Scenario: Upgrade for an unknown canvas id returns 404

- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>` for a `<canvasId>` that does not exist in the `canvases` table
- **THEN** the server MUST return HTTP 404 with body `{ error: "errors.canvas.notFound" }`
- **AND** the server MUST NOT upgrade the connection


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: WebSocket handshake authenticates the user via session cookie

The server SHALL accept TWO authentication paths on the Upgrade request:

1. **Session-cookie path** — when the request has no `?token=` query parameter, the server SHALL parse the better-auth session cookie using `apps/api/src/auth/session-cookie-parser.ts`. The server SHALL reject with HTTP 401 `errors.auth.unauthorized` when the cookie is absent, expired, or invalid.
2. **Public-link-token path** — when the request URL carries `?token=<value>`, the server SHALL look up `canvas_share_links` by the token. The server SHALL accept the request as anonymous (no session required) when the row exists, its `canvas_id` matches the path, and its `mode` is not `'closed'`. The server SHALL reject with HTTP 403 `errors.canvas.forbidden` when the token does not match a row, the canvas id mismatches, or the mode is `'closed'`. When the request also carries a valid session cookie alongside `?token=`, the server SHALL prefer the session-cookie path so logged-in editors do not lose their identity by clicking a public link.

#### Scenario: Missing cookie is rejected before upgrade

- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>` with no `Cookie` header and no `?token=` query
- **THEN** the server MUST return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`
- **AND** the server MUST NOT upgrade the connection

#### Scenario: Expired session cookie is rejected before upgrade

- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>` carrying a session cookie whose underlying session has expired or been revoked, and no `?token=` query
- **THEN** the server MUST return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`
- **AND** the server MUST NOT upgrade the connection

#### Scenario: Public-link token allows anonymous upgrade when mode is view

- **GIVEN** a `canvas_share_links` row exists for `<canvasId>` with `mode='view'`
- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>?token=<that-row's-token>` with NO `Cookie` header
- **THEN** the server MUST upgrade the connection
- **AND** the resulting WebSocket context MUST carry an `anon:` user id

#### Scenario: Public-link token in closed mode is rejected

- **GIVEN** a `canvas_share_links` row exists with `mode='closed'`
- **WHEN** any request arrives at `/sync/<canvasId>?token=<that-row's-token>`
- **THEN** the server MUST return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`

#### Scenario: Token mismatched to canvas id is rejected

- **WHEN** an Upgrade request arrives at `/sync/<canvasA>?token=<canvasB-link-token>`
- **THEN** the server MUST return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`

#### Scenario: Session cookie wins over share token when both are present

- **WHEN** an Upgrade request arrives carrying BOTH a valid session cookie for an authenticated user AND a `?token=<...>` query
- **THEN** the server MUST authenticate via the session cookie path
- **AND** the WebSocket context MUST carry the authenticated user's id (NOT an `anon:` id)


<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: WebSocket handshake authorizes the user against the canvas

After authentication, the server SHALL determine the connecting role using the canvas-management `canAccess(user, canvas, action, ctx)` predicate. The role SHALL be `'editor'` when the predicate grants `'write'` and `'viewer'` when it grants only `'read'`. The server SHALL reject the upgrade with HTTP 403 and body `{ error: "errors.canvas.forbidden" }` when neither write nor read is granted. The role determined at handshake SHALL be attached to the WebSocket context and SHALL be passed to `room.handleSocketConnect` as `isReadonly = (role === 'viewer')`.

#### Scenario: Authenticated user without a role is rejected

- **WHEN** an authenticated user issues an Upgrade request at `/sync/<canvasId>` for a canvas they neither own nor have any share row for, and no public-link token is supplied
- **THEN** the server MUST return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`

#### Scenario: Shared viewer upgrades with view-only role attached

- **WHEN** an authenticated user with a `canvas_shares` row of role `viewer` upgrades at `/sync/<canvasId>`
- **THEN** the server MUST upgrade the connection
- **AND** the room session MUST be created with `isReadonly=true`

#### Scenario: Public-link-edit visitor upgrades with editor role

- **GIVEN** `canvas_share_links.mode === 'edit'`
- **WHEN** an unauthenticated browser upgrades at `/sync/<canvasId>?token=<link-token>`
- **THEN** the server MUST upgrade the connection
- **AND** the room session MUST be created with `isReadonly=false`

##### Example: full handshake outcome matrix

| Authentication source | sharedRole | publicLinkMode | Expected outcome |
| --------------------- | ---------- | -------------- | ---------------- |
| owner cookie | (n/a) | (n/a) | upgrade, role `editor`, isReadonly=false |
| editor share cookie | editor | (n/a) | upgrade, role `editor`, isReadonly=false |
| viewer share cookie | viewer | (n/a) | upgrade, role `viewer`, isReadonly=true |
| no relation cookie | null | (n/a) | HTTP 403 `errors.canvas.forbidden` |
| no cookie + valid token | (n/a) | view | upgrade, role `viewer`, isReadonly=true |
| no cookie + valid token | (n/a) | edit | upgrade, role `editor`, isReadonly=false |
| no cookie + valid token | (n/a) | closed | HTTP 403 `errors.canvas.forbidden` |
| no cookie + invalid token | (n/a) | (n/a) | HTTP 403 `errors.canvas.forbidden` |
| canvas missing | (n/a) | (n/a) | HTTP 404 `errors.canvas.notFound` |


<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: WebSocket handshake enforces connection rate limits

Before upgrading, the server SHALL check two rate-limit rules registered in `apps/api/src/lib/rate-limit-rules.ts`: `ws.connect.per_user_canvas` (concurrent connection limit per `(userId, canvasId)` of 5) and `ws.connect.per_ip` (token bucket of 30 new connections per minute per source IP). Either rule exceeding its limit SHALL cause the server to reject the upgrade with HTTP 429, body `{ error: "errors.rateLimit", retryAfter: <seconds> }`, and a `Retry-After` header.

#### Scenario: Sixth concurrent connection from the same user to the same canvas is rejected

- **WHEN** an authenticated user already has 5 open WebSocket connections to `/sync/<canvasId>` and issues a 6th Upgrade request to the same path
- **THEN** the server MUST return HTTP 429 with body `{ error: "errors.rateLimit", retryAfter: <seconds> }`
- **AND** the response MUST include a `Retry-After` header
- **AND** the server MUST NOT upgrade the connection

#### Scenario: 31st new connection within a minute from one IP is rejected

- **WHEN** the same source IP issues a 31st new WebSocket Upgrade request within a 60-second sliding window
- **THEN** the server MUST return HTTP 429 with body `{ error: "errors.rateLimit", retryAfter: <seconds> }`
- **AND** the response MUST include a `Retry-After` header
- **AND** the server MUST NOT upgrade the connection

#### Scenario: Closing a connection frees its concurrent slot

- **WHEN** a user has 5 open WebSocket connections to `/sync/<canvasId>` and one connection closes
- **THEN** the server MUST allow that user's next Upgrade request at `/sync/<canvasId>` to proceed past the `ws.connect.per_user_canvas` check


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Sync rooms are created lazily and released after idle

The server SHALL maintain an in-process room registry keyed by `canvasId`. When the first authenticated WebSocket connection is upgraded for a `canvasId`, the server SHALL create exactly one room instance for that id, hydrating the tldraw document from the latest persisted snapshot. When a connection closes, the server SHALL decrement the room's connection count. When the room's connection count reaches zero, the server SHALL start a 60-second idle timer; if a new connection arrives before the timer expires the timer SHALL be cancelled. When the timer expires the server SHALL flush any pending dirty state to the database before disposing the room.

#### Scenario: First connection creates the room and hydrates from DB

- **WHEN** the first WebSocket connection for `<canvasId>` is upgraded and no room exists in the registry
- **THEN** the server MUST create a room for `<canvasId>`
- **AND** the server MUST initialize the room's tldraw document from `canvases.snapshot` for that id
- **AND** the server MUST register the connection against the new room

#### Scenario: Idle timer cancels when a new connection arrives

- **WHEN** a room's connection count reaches zero and a 60-second idle timer is started, and a new authenticated Upgrade request for the same `<canvasId>` arrives 30 seconds later
- **THEN** the server MUST cancel the idle timer
- **AND** the server MUST register the new connection against the existing room without re-hydrating from DB

#### Scenario: Idle timer expiration flushes and disposes the room

- **WHEN** a room's connection count is zero, the 60-second idle timer expires, and the room has dirty state since its last flush
- **THEN** the server MUST flush the latest tldraw document to `canvases.snapshot` for that id
- **AND** the server MUST remove the room from the registry after the flush completes


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Sync server flushes snapshots on a debounced cadence

The server SHALL persist the authoritative tldraw document for each room to the `canvases.snapshot` jsonb column on a debounce-and-cap schedule. After any change to the room's document, a flush SHALL be scheduled to occur 2 seconds after the most recent change (trailing-edge debounce). Independently, if the time since the last successful flush exceeds 10 seconds while the room is dirty, a flush SHALL be issued immediately. Each flush SHALL replace the entire `canvases.snapshot` value (no incremental patches).

#### Scenario: Burst of operations coalesces into a single flush

- **WHEN** a room receives 10 document-changing operations within 1 second and no further operations follow
- **THEN** the server MUST issue exactly one DB write to `canvases.snapshot` for that canvas
- **AND** the write MUST occur approximately 2 seconds after the last operation in the burst

#### Scenario: Continuous activity triggers periodic forced flushes

- **WHEN** a room receives document-changing operations continuously such that the 2-second idle window never closes
- **THEN** the server MUST issue at least one DB write to `canvases.snapshot` for every 10 seconds the room remains dirty

##### Example: flush schedule under three workloads

| Workload | Pattern | Expected DB writes |
| -------- | ------- | ------------------ |
| Single edit | 1 op at t=0, none after | 1 write at ~t=2s |
| Short burst | 10 ops over 1s, none after | 1 write at ~t=3s (2s after last op) |
| Continuous | 1 op every 500ms for 25s | 2 or 3 writes (each at most 10s after previous flush) |

#### Scenario: Failed flush logs the error and retries on next opportunity

- **WHEN** a flush DB write fails with a transient error
- **THEN** the server MUST log the error using the structured logger (`apps/api/src/lib/logger.ts`)
- **AND** the room MUST remain dirty so that the next debounce or cap window triggers a retry


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Server hydrates rooms from DB and resists overwrites by HTTP

When a room is created, the server SHALL read the current `canvases.snapshot` value for the canvas and use it as the room's initial document. While a room exists for a `canvasId`, the existing `PATCH /api/canvas/:id` endpoint that writes `snapshot` SHALL reject the request with HTTP 409 and body `{ error: "errors.canvas.activeRoom" }` to prevent HTTP-driven overwrites of in-memory authoritative state.

#### Scenario: Cold start hydration after server restart

- **WHEN** the server starts and the first WebSocket connection for `<canvasId>` is upgraded
- **THEN** the server MUST read the latest `canvases.snapshot` for `<canvasId>` from the database
- **AND** the room's tldraw document MUST be initialized from that value before the first message is forwarded

#### Scenario: HTTP snapshot write while room is active is rejected

- **WHEN** an active room exists for `<canvasId>` and an authenticated owner sends `PATCH /api/canvas/<canvasId>` with a `snapshot` field
- **THEN** the server MUST return HTTP 409 with body `{ error: "errors.canvas.activeRoom" }`
- **AND** the server MUST NOT modify `canvases.snapshot` in the database

#### Scenario: HTTP snapshot write succeeds when no room is active

- **WHEN** no room exists for `<canvasId>` and an authenticated owner sends `PATCH /api/canvas/<canvasId>` with a valid `snapshot` field
- **THEN** the server MUST update `canvases.snapshot` for that canvas
- **AND** the server MUST return HTTP 200


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Sync rooms broadcast cursor and presence via tldraw awareness

Each room SHALL forward awareness messages (cursor position, selection, presence identity) between its connected clients using the tldraw sync awareness channel. The server SHALL include the authenticated user's `id`, `name`, and `image` (sourced from the `users` table at handshake) in the presence payload broadcast to peers. The server SHALL NOT persist awareness data to the database.

#### Scenario: New connection receives the current peer presence snapshot

- **WHEN** a new client connects to a room that already has 2 other connected peers
- **THEN** the new client MUST receive an awareness snapshot containing the presence entries for both existing peers within 1 second of the WebSocket open event

#### Scenario: Cursor movement is forwarded without DB writes

- **WHEN** a connected client emits an awareness update containing a new cursor position
- **THEN** the server MUST forward that awareness update to all other connected clients in the same room
- **AND** the server MUST NOT trigger a DB write to `canvases.snapshot` as a result of the awareness update

#### Scenario: Presence is removed when a client disconnects

- **WHEN** a connected client closes its WebSocket
- **THEN** every remaining peer in the same room MUST receive an awareness update that removes the disconnected client's presence entry within 1 second of the close event


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Client reconnects with exponential backoff and stops on permanent failures

The client sync hook (`apps/web/src/canvas/use-sync-store.ts`) SHALL maintain a Zustand store that exposes the current connection state (`connecting | connected | reconnecting | disconnected`). On a transient close (e.g., network drop, close codes other than 4401, 4403, 4404, 4429), the hook SHALL retry the connection up to 5 times with delays of 1s, 2s, 4s, 8s, 16s, each delay augmented by a uniform random jitter of ±20%. After 5 failed reconnect attempts the hook SHALL transition to `disconnected` and SHALL NOT attempt further reconnects until the page is reloaded. On a permanent close code (4401, 4403, 4404, 4429) the hook SHALL transition directly to `disconnected` without retrying.

#### Scenario: Transient disconnect triggers reconnect attempts

- **WHEN** the WebSocket closes with a non-permanent code (e.g., 1006) while the local user is editing
- **THEN** the connection state MUST transition to `reconnecting`
- **AND** the hook MUST schedule a reconnect attempt approximately 1 second later (within ±20% jitter)

#### Scenario: Permanent permission failure does not retry

- **WHEN** the WebSocket closes with code 4403
- **THEN** the connection state MUST transition directly to `disconnected`
- **AND** the hook MUST NOT schedule any reconnect attempts

##### Example: reconnect delay schedule

| Attempt | Base delay | Jitter range |
| ------- | ---------- | ------------ |
| 1 | 1000 ms | 800–1200 ms |
| 2 | 2000 ms | 1600–2400 ms |
| 3 | 4000 ms | 3200–4800 ms |
| 4 | 8000 ms | 6400–9600 ms |
| 5 | 16000 ms | 12800–19200 ms |
| 6+ | (no further attempts) | n/a |

#### Scenario: Successful reconnect transitions back to connected

- **WHEN** a reconnect attempt succeeds (WebSocket open + first server hello received)
- **THEN** the connection state MUST transition to `connected`
- **AND** the reconnect attempt counter MUST reset to zero


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Sync server uses defined close codes for protocol-level failures

The server SHALL terminate WebSocket connections with the following numeric close codes when the corresponding condition occurs after upgrade: `4401` for an authentication state lost mid-session, `4403` for a permission revoked mid-session, `4404` for a canvas deleted mid-session, `4429` for a rate-limit violation detected on an established connection, `4001` for server-initiated graceful closure (room idle release or server shutdown). All five codes are in the application-defined 4xxx range so they survive WebSocket normalization (Bun rewrites standard 1001 → 1000 when sent explicitly via `ws.close`). Each close SHALL be accompanied by a structured log entry including `userId`, `canvasId`, and the reason.

#### Scenario: Canvas deletion during a live session closes peers with 4404

- **WHEN** a canvas is deleted via the existing canvas delete endpoint while at least one WebSocket connection is open for that `canvasId`
- **THEN** the server MUST close every WebSocket associated with that room using close code `4404`
- **AND** the server MUST remove the room from the registry

#### Scenario: Server shutdown closes connections with 4001

- **WHEN** the server begins a graceful shutdown
- **THEN** the server MUST close every open sync WebSocket using close code `4001`
- **AND** before closing each room the server MUST flush any pending dirty state to `canvases.snapshot`

<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Sync server kicks affected sessions when access is revoked

The sync server SHALL expose a `notifyAccessRevoked(canvasId, scope)` method where `scope` is one of `{ kind: 'user', userId }`, `{ kind: 'all-anonymous' }`, or `{ kind: 'all' }`. When invoked, the server SHALL close every open WebSocket against the named canvas that matches the scope using close code `4403` (`{ kind: 'all' }` uses `4404` as defined under canvas-deletion semantics). The sharing capability invokes this hook from share/role/link mutations.

#### Scenario: Removing a member closes that user's open sessions

- **GIVEN** user `u-x` has two open WebSocket sessions against canvas `<id>` and the owner has just removed their share
- **WHEN** the sharing handler invokes `notifyAccessRevoked(<id>, { kind: 'user', userId: 'u-x' })`
- **THEN** both of `u-x`'s WebSocket connections MUST be closed with code 4403
- **AND** other users' connections to the same canvas MUST remain open

#### Scenario: Setting public-link mode to closed kicks anonymous sessions

- **GIVEN** three open sessions exist for canvas `<id>`: one editor cookie, one anon-via-link, one anon-via-link
- **WHEN** the sharing handler invokes `notifyAccessRevoked(<id>, { kind: 'all-anonymous' })`
- **THEN** the two anonymous connections MUST be closed with code 4403
- **AND** the editor cookie connection MUST remain open

#### Scenario: Rotating the public link kicks anonymous sessions

- **GIVEN** an anonymous visitor is connected with token `T1`
- **WHEN** the owner rotates the link, replacing the token with `T2`, and the sharing handler invokes `notifyAccessRevoked(<id>, { kind: 'all-anonymous' })`
- **THEN** the anonymous visitor's connection MUST be closed with code 4403


<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: Viewer role connects in read-only mode

When the handshake resolves a `viewer` role (cookie path) or a `view`-mode public-link path, the sync server SHALL register the session with `room.handleSocketConnect({ ..., isReadonly: true })`. The TLSocketRoom contract guarantees that operations originating from a readonly session are rejected before broadcast. The web client SHALL also pass `isReadonly` through to the tldraw editor so the UI reflects the read-only state (toolbar disabled, shapes not selectable for mutation).

#### Scenario: Viewer cannot mutate the room state via WebSocket

- **GIVEN** a viewer-role WebSocket session is open against canvas `<id>` and a peer editor session is open as well
- **WHEN** the viewer client sends a `push` message containing a shape diff
- **THEN** the room MUST NOT apply the change to the shared state
- **AND** the editor peer MUST NOT receive a corresponding broadcast

#### Scenario: View-mode public link grants viewer role isReadonly true

- **GIVEN** `canvas_share_links.mode === 'view'`
- **WHEN** an anonymous browser upgrades at `/sync/<id>?token=<link-token>`
- **THEN** the WebSocket context MUST record the role as `viewer`
- **AND** the room session MUST be created with `isReadonly=true`

<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: Custom shapes enforce a first-editor-wins edit lock during multiplayer sessions

When two or more users have the same canvas open and one user begins editing a custom shape (Markdown / Code / Callout / Link card as defined by the `canvas-shapes` capability), other users SHALL be prevented from entering the same shape's editor until the first user exits or the lock times out. The lock MUST be derived from tldraw's existing `editingShapeId` field combined with the local presence record, NOT from a separate server-side lock table.

A custom hook `useShapeEditLock(shapeId)` in `apps/web/src/canvas/shapes/use-shape-edit-lock.ts` SHALL return `{ canEdit: boolean; lockedBy: { userId: string; userName: string } | null }`. It MUST resolve as follows:

- If `editingShapeId` from any other user's presence equals `shapeId`, return `canEdit: false` with `lockedBy` populated from that user's presence
- If `editingShapeId` is null OR equals `shapeId` for the local user, return `canEdit: true, lockedBy: null`

The hook MUST update reactively when remote presence changes.

When `canEdit` is false, the shape's view MUST display a localized lock badge using the key `shapes.common.lockedBy` interpolated with the locking user's name. The shape's editor entry points (double-click for markdown / callout, focus for code textarea, URL edit for link card) MUST be disabled while locked.

The lock MUST automatically clear when the locking user disconnects (tldraw presence heartbeat removes their record) or when their presence's `lastActiveAt` exceeds 5 minutes (stale-lock fallback for tabs that didn't disconnect cleanly).

#### Scenario: Second user sees lock badge while first user edits

- **WHEN** user A double-clicks a markdown shape and the editor dialog opens, then user B looks at the same canvas
- **THEN** user B's view of that markdown shape MUST display a lock badge with user A's name and MUST NOT allow user B to open the editor by double-click

#### Scenario: Lock releases when first user closes editor

- **WHEN** user A's editor dialog closes (Save or Escape) and `editingShapeId` clears
- **THEN** within one tldraw sync tick, user B's view MUST remove the lock badge and double-click MUST open the editor

#### Scenario: Stale lock clears after 5 minutes of inactivity

- **WHEN** user A enters edit mode on a shape and their tab becomes unresponsive for 6 minutes without a clean disconnect
- **THEN** user B's view of the shape MUST clear the lock badge after the 5-minute threshold and double-click MUST become available

#### Scenario: Locking user's own view is unaffected

- **WHEN** user A is editing a shape and `editingShapeId` equals that shape for user A's local presence
- **THEN** user A's view MUST NOT display the lock badge and the editor MUST function normally

<!-- @trace
source: add-custom-shapes
updated: 2026-05-04
code:
  - apps/api/src/og/parse-html.ts
  - apps/web/src/canvas/Editor.tsx
  - apps/api/src/sync/shape-schemas.ts
  - apps/web/src/canvas/shapes/link-card-state.ts
  - docs/adr/0009-shape-edit-lock-vs-crdt.md
  - apps/api/src/index.ts
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - apps/web/src/chrome/index.tsx
  - apps/web/src/canvas/VellumToolbar.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/shapes/use-shape-edit-lock.ts
  - bun.lock
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/src/styles.css
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/canvas/shapes/paste-detect.ts
  - docs/adr/0008-markdown-engine-marked.md
  - apps/web/src/canvas/shapes/code-highlight.ts
  - apps/api/src/og/index.ts
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - apps/web/src/canvas/shapes/markdown-parser.ts
  - docs/adr/0010-link-card-cache-two-tier.md
  - apps/api/package.json
  - apps/web/src/canvas/FloatingShapeToolbar.tsx
  - apps/web/src/canvas/shapes/clipboard.ts
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/package.json
  - apps/api/src/lib/rate-limit-rules.ts
tests:
  - apps/web/src/canvas/shapes/link-card-state.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/shapes/markdown-parser.test.ts
  - apps/api/src/og/parse-html.test.ts
  - apps/web/src/canvas/shapes/markdown-shape.test.tsx
  - apps/web/src/canvas/shapes/code-highlight.test.ts
  - apps/web/src/canvas/shapes/code-shape.test.tsx
  - apps/web/src/canvas/shapes/use-shape-edit-lock.test.ts
  - apps/web/src/canvas/shapes/link-card-shape.test.tsx
  - apps/api/src/og/index.test.ts
  - apps/web/src/canvas/shapes/callout-shape.test.tsx
  - apps/web/src/canvas/shapes/paste-detect.test.ts
  - apps/web/src/canvas/ShapeToolbar.test.tsx
-->

---
### Requirement: Tldraw asset store inlines image uploads as same-origin data URLs

The client-side `TLAssetStore.upload` implementation in `apps/web/src/canvas/use-sync-store.ts` SHALL accept any of the supported image MIME types (`image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`), encode the file contents as a `data:` URL, and return `{ src }` so tldraw's built-in image shape can render the result. This replaces the prior "always throw" behavior. Uploads SHALL be performed entirely client-side: NO HTTP request is issued to any backend endpoint and NO blob storage / CDN integration is performed (those remain Phase 2 scope).

The encoded `src` SHALL be persisted as part of the canvas snapshot via tldraw sync, so reloading the page or re-syncing from another client renders the image without a re-upload.

A pure helper function `inlineImageAsset(file: File): Promise<{ src: string }>` SHALL live in `apps/web/src/canvas/asset-inline.ts`. The asset-store wrapper SHALL delegate to this helper. Encoding rules:

- `image/svg+xml`: read with `file.text()`, sanitize via DOMPurify with the SVG profile (`USE_PROFILES: { svg: true, svgFilters: true }`), then `data:image/svg+xml;utf8,${encodeURIComponent(sanitized)}`.
- Other supported MIME types: `data:${mime};base64,${btoa(<bytes>)}` where bytes come from `file.arrayBuffer()`.

#### Scenario: PNG upload renders inline

- **WHEN** the user uploads a 100 KB PNG file via the tldraw image tool
- **THEN** the resulting image shape's asset MUST have `src` starting with `"data:image/png;base64,"` and the canvas MUST display the image; NO outbound HTTP request to any vellum endpoint is issued

#### Scenario: SVG upload is sanitized before encoding

- **WHEN** the user uploads an SVG whose contents contain a `<script>alert(1)</script>` element
- **THEN** the resulting `src` data URL MUST NOT contain the `<script>` tag (case-insensitive substring check) and the canvas MUST still render the rest of the SVG markup

##### Example: SVG sanitisation

| Input fragment | Expected behavior |
| -------------- | ----------------- |
| `<svg><script>x()</script><circle r="5"/></svg>` | result `src` decoded MUST contain `<circle` and MUST NOT contain `<script` |
| `<svg><image onclick="x()" href="a.png"/></svg>` | result `src` decoded MUST NOT contain `onclick=` |
| `<svg><foreignObject><iframe/></foreignObject></svg>` | result `src` decoded MUST NOT contain `<iframe` |

#### Scenario: Image survives reload

- **WHEN** a user uploads an image, then reloads the page
- **THEN** the image shape MUST re-render with the same content (the snapshot persisted the data URL)


<!-- @trace
source: fix-image-asset-inline
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0011-image-asset-phase1-data-url.md
  - apps/web/src/canvas/asset-inline.ts
tests:
  - apps/web/src/canvas/asset-inline.test.ts
-->

---
### Requirement: Asset store rejects oversize and unsupported uploads with localized errors

`inlineImageAsset` and the wrapping asset-store upload SHALL reject files in two cases by throwing an `Error` whose `message` is exactly the i18n errorKey:

- File size strictly greater than `5 * 1024 * 1024` bytes → `errors.image.tooLarge`
- File MIME type not in the supported set (`image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`) → `errors.image.unsupportedFormat`

These errorKeys MUST be present in both `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` under `errors.image`. The tldraw editor surfaces upload errors as a toast with the thrown message, so the toast layer SHALL look up the errorKey via `t(error.message)` to display the translated string.

The pre-throw checks MUST happen BEFORE any expensive read (`file.arrayBuffer()` / `file.text()`) so a 50 MB BMP rejects in O(1) without holding bytes in memory.

#### Scenario: 6 MB PNG rejected

- **WHEN** the user uploads a 6 MB PNG file
- **THEN** `inlineImageAsset` MUST throw an `Error` with `message === "errors.image.tooLarge"` and MUST NOT call `file.arrayBuffer()` (no expensive read attempted)

#### Scenario: PDF upload rejected

- **WHEN** the user uploads a file whose MIME type is `application/pdf`
- **THEN** `inlineImageAsset` MUST throw an `Error` with `message === "errors.image.unsupportedFormat"`

#### Scenario: HEIC upload rejected

- **WHEN** the user uploads a file whose MIME type is `image/heic`
- **THEN** `inlineImageAsset` MUST throw an `Error` with `message === "errors.image.unsupportedFormat"` (HEIC is intentionally Phase 1 out-of-scope)

#### Scenario: Localized error keys present in both locales

- **WHEN** the change is committed
- **THEN** `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` MUST both contain the keys `errors.image.tooLarge` and `errors.image.unsupportedFormat`

<!-- @trace
source: fix-image-asset-inline
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0011-image-asset-phase1-data-url.md
  - apps/web/src/canvas/asset-inline.ts
tests:
  - apps/web/src/canvas/asset-inline.test.ts
-->

---
### Requirement: Sync server flushes snapshots on every mutation via a debounced + cap window writer

In addition to the existing idle-release and graceful-shutdown flush paths, the sync server SHALL flush every dirty canvas's snapshot to the database on a mutation-driven debounce. A `SnapshotPersister` instance with `debounceMs = 2_000` (trailing-edge debounce after the most recent mutation) and `capMs = 10_000` (forced flush within 10 seconds even under continuous activity) SHALL be wired in `apps/api/src/index.ts` as the primary persistence path. Each `TLSocketRoom` created by the room registry SHALL register an `onDataChange` callback that calls `persister.notifyDirty(canvasId, () => room.getCurrentSnapshot())`.

This requirement complements (does NOT replace) the existing idle-release flush in `RoomRegistry.disposeIdle()` and the graceful-shutdown flush in `RoomRegistry.closeAll()`. After this change there are three independent flush paths covering different liveness conditions:

1. **Mutation-driven (this requirement)** — fires within ≤ 10 s during active editing
2. **Idle release** — fires `idleReleaseMs` (60 s) after the last connection drops
3. **Graceful shutdown** — fires once on SIGTERM via `shutdownGracefully`

#### Scenario: continuous editing flushes within the cap window

- **WHEN** a single canvas receives mutations every 1 second for 30 consecutive seconds (no idle gap, no shutdown)
- **THEN** the canvas's `canvases.snapshot` row in Postgres MUST be updated at least 3 times during that window (once per ≤ 10-second cap), and the final `documentClock` value MUST reflect the last mutation within ≤ 12 seconds (cap 10 s + DB latency budget 2 s)

#### Scenario: bursty editing flushes after the trailing-edge debounce

- **WHEN** a canvas receives 5 mutations within 500 ms then no mutations for 3 seconds
- **THEN** Postgres MUST be written exactly once for that burst, between 2.0 s and 2.5 s after the last mutation in the burst (trailing-edge debounce)

#### Scenario: idle release path is preserved

- **WHEN** all sync connections to a canvas drop and the room sits idle for 60 seconds
- **THEN** `RoomRegistry.disposeIdle()` MUST still fire and write the latest snapshot to Postgres exactly once, regardless of whether the mutation-driven persister has already flushed the same state


<!-- @trace
source: fix-sync-snapshot-flush
updated: 2026-05-05
code:
  - apps/api/src/sync/wiring.ts
  - apps/api/src/index.ts
  - docs/adr/0012-mutation-driven-snapshot-flush.md
tests:
  - apps/api/src/sync/persistence-wiring.test.ts
-->

---
### Requirement: Graceful shutdown flushes the persister before disposing rooms

`shutdownGracefully(signal)` in `apps/api/src/index.ts` SHALL await `persister.flushAll()` BEFORE awaiting `syncServer.shutdown()` (which calls `RoomRegistry.closeAll()`). This ordering guarantees that any snapshot whose `notifyDirty` was scheduled but whose debounce timer had not yet fired is force-written before rooms are disposed.

If `persister.flushAll()` rejects, the error MUST be logged via the injected logger but the shutdown sequence MUST continue (do not block the shutdown on a failed DB write — the dirty entry stays in `canvases.snapshot` from a previous successful flush, and the operator can investigate the logged error).

#### Scenario: SIGTERM flushes pending debounce before closing rooms

- **WHEN** a canvas has received a mutation 1 second before `SIGTERM` arrives (so the 2 s debounce timer is still pending) and `shutdownGracefully` runs
- **THEN** the persister's pending flush MUST complete (writing to Postgres) BEFORE `syncServer.shutdown()` is awaited; the resulting snapshot MUST contain the mutation

#### Scenario: persister flush failure does not block shutdown

- **WHEN** `persister.flushAll()` rejects (simulated DB outage)
- **THEN** the error MUST be logged AND `syncServer.shutdown()` MUST still be awaited; the process MUST continue toward exit

<!-- @trace
source: fix-sync-snapshot-flush
updated: 2026-05-05
code:
  - apps/api/src/sync/wiring.ts
  - apps/api/src/index.ts
  - docs/adr/0012-mutation-driven-snapshot-flush.md
tests:
  - apps/api/src/sync/persistence-wiring.test.ts
-->