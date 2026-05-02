## ADDED Requirements

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

### Requirement: WebSocket handshake authenticates the user via session cookie

The server SHALL parse the better-auth session cookie carried on the Upgrade request using `apps/api/src/auth/session-cookie-parser.ts`. The server SHALL reject the upgrade with HTTP 401 and body `{ error: "errors.auth.unauthorized" }` when the cookie is absent, expired, or invalid.

#### Scenario: Missing cookie is rejected before upgrade

- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>` with no `Cookie` header
- **THEN** the server MUST return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`
- **AND** the server MUST NOT upgrade the connection

#### Scenario: Expired session cookie is rejected before upgrade

- **WHEN** an HTTP Upgrade request arrives at `/sync/<canvasId>` carrying a session cookie whose underlying session has expired or been revoked
- **THEN** the server MUST return HTTP 401 with body `{ error: "errors.auth.unauthorized" }`
- **AND** the server MUST NOT upgrade the connection

### Requirement: WebSocket handshake authorizes the user against the canvas

After authentication, the server SHALL invoke `PermissionChecker.canAccess(userId, canvasId, action)` (`apps/api/src/lib/permission.ts`), where `action` is `'edit'` for canvas owners and shared editors, or `'view'` for shared viewers. The server SHALL reject the upgrade with HTTP 403 and body `{ error: "errors.canvas.forbidden" }` when the user has no role on the canvas. The role determined at handshake SHALL be attached to the WebSocket context for downstream message handling.

#### Scenario: Authenticated user without a role is rejected

- **WHEN** an authenticated user issues an Upgrade request at `/sync/<canvasId>` for a canvas they neither own nor have any share row for
- **THEN** the server MUST return HTTP 403 with body `{ error: "errors.canvas.forbidden" }`
- **AND** the server MUST NOT upgrade the connection

#### Scenario: Shared viewer upgrades with view-only role attached

- **WHEN** an authenticated user with a `canvas_shares` row of role `viewer` upgrades at `/sync/<canvasId>`
- **THEN** the server MUST upgrade the connection
- **AND** the WebSocket context MUST record the user's role as `viewer`

##### Example: handshake outcome by user role

| User relation to canvas | Expected outcome |
| ----------------------- | ---------------- |
| owner | upgrade with role `editor` |
| `canvas_shares` row with role `editor` | upgrade with role `editor` |
| `canvas_shares` row with role `viewer` | upgrade with role `viewer` |
| no relation | HTTP 403 `errors.canvas.forbidden` |
| invalid session cookie | HTTP 401 `errors.auth.unauthorized` |
| canvas does not exist | HTTP 404 `errors.canvas.notFound` |

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
