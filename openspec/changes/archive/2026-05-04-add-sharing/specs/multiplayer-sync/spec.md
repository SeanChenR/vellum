## MODIFIED Requirements

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

## ADDED Requirements

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
