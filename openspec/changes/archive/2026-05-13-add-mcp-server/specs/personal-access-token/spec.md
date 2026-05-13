## ADDED Requirements

### Requirement: Personal access tokens are persisted as opaque hashed entries per user

The system SHALL provide a `personal_access_tokens` table that stores user-managed long-lived tokens. Each row SHALL contain: `id` (ulid primary key), `user_id` (FK → `users.id` with cascade delete), `name` (1..64 char user-supplied label), `token_hash` (SHA-256 hex of the plaintext token, with a unique partial index over rows where `revoked_at IS NULL`), `token_prefix` (first 12 characters of the plaintext for UI display and secret scanner integration, e.g. `vlm_pat_a3f2`), `scope` (nullable text, reserved for future fine-grained scopes — `NULL` denotes unrestricted in M15), `expires_at` (nullable timestamptz — `NULL` denotes never expires), `last_used_at` (nullable timestamptz, throttled), `created_at` (timestamptz default `now()`), and `revoked_at` (nullable timestamptz, soft delete marker).

The plaintext token SHALL be `vlm_pat_` + 32 base62 characters (total 40 chars). The plaintext SHALL only be returned to the user in the response to `POST /api/account/pat` — no subsequent endpoint SHALL return it. The DB SHALL NEVER store the plaintext.

#### Scenario: Inserting a token stores the SHA-256 hash and not the plaintext

- **GIVEN** a user U1
- **WHEN** the server creates a new PAT for U1 with plaintext `vlm_pat_abc123...` (40 chars)
- **THEN** the DB row SHALL have `token_hash` equal to the SHA-256 hex of the plaintext
- **AND** the DB row SHALL have `token_prefix` equal to `"vlm_pat_abc1"` (first 12 chars)
- **AND** no DB column SHALL contain the plaintext.

#### Scenario: Cascade delete removes tokens when user is deleted

- **GIVEN** user U1 has 3 PATs in the table
- **WHEN** U1's row in the `users` table is deleted
- **THEN** all 3 PAT rows SHALL be removed by cascade.

#### Scenario: Unique partial index permits a revoked hash to be reused

- **GIVEN** PAT row P1 with `token_hash = H` and `revoked_at = NOW()`
- **WHEN** a new PAT row P2 is inserted with the same `token_hash = H` and `revoked_at = NULL`
- **THEN** the insertion SHALL succeed (the partial unique index only enforces uniqueness over active rows).

### Requirement: GET /api/account/pat lists the signed-in user's active tokens

The endpoint `GET /api/account/pat` SHALL return all non-revoked tokens for the authenticated user, ordered by `created_at DESC`. Each entry SHALL contain `id`, `name`, `prefix`, `expiresAt`, `lastUsedAt`, `createdAt`. The plaintext token and `token_hash` SHALL NEVER appear in the response. Unauthenticated requests SHALL receive HTTP 401.

#### Scenario: List endpoint returns user's tokens in reverse creation order

- **GIVEN** user U1 has tokens P1 (created at T0), P2 (created at T1 > T0), and P3 revoked at T2
- **WHEN** U1's session calls `GET /api/account/pat`
- **THEN** the response SHALL be `{data: [{id: P2.id, ...}, {id: P1.id, ...}]}`
- **AND** P3 SHALL NOT appear in the response.

#### Scenario: List endpoint omits token_hash and plaintext

- **WHEN** an authenticated user calls `GET /api/account/pat`
- **THEN** the response body SHALL NOT contain any field named `token`, `tokenHash`, `token_hash`, or `plaintext`.

#### Scenario: Unauthenticated GET returns 401

- **GIVEN** no session cookie on the request
- **WHEN** the request hits `GET /api/account/pat`
- **THEN** the server SHALL respond with HTTP 401.

### Requirement: POST /api/account/pat creates a token and returns the plaintext exactly once

The endpoint `POST /api/account/pat` SHALL accept body `{name: string (1..64 chars), expiresInDays?: 30 | 90 | null}` and return HTTP 201 with body `{data: {token: <plaintext, only this response>, id, name, prefix, expiresAt, createdAt}}`. The plaintext token SHALL be cryptographically random (32 base62 chars after the `vlm_pat_` prefix). The server SHALL compute `expires_at = now() + expiresInDays days` when `expiresInDays` is provided, or store `NULL` when omitted. The plaintext SHALL be returned ONLY in this single response — no subsequent endpoint SHALL expose it.

#### Scenario: Successful creation returns plaintext and id

- **GIVEN** an authenticated user
- **WHEN** the client POSTs `{name: "Claude Desktop on Mac", expiresInDays: 90}`
- **THEN** the response SHALL be HTTP 201
- **AND** the body SHALL contain a `data.token` string starting with `"vlm_pat_"`
- **AND** the body SHALL contain a non-empty `data.id`
- **AND** `data.prefix` SHALL equal the first 12 characters of `data.token`
- **AND** `data.expiresAt` SHALL be approximately 90 days in the future.

#### Scenario: expiresInDays null means never expires

- **WHEN** the client POSTs `{name: "perpetual", expiresInDays: null}`
- **THEN** the resulting DB row SHALL have `expires_at = NULL`
- **AND** the response `data.expiresAt` SHALL be `null`.

#### Scenario: Invalid body returns 400 invalidPayload

- **WHEN** the client POSTs `{}` (missing `name`)
- **THEN** the response SHALL be HTTP 400 with body containing `errorKey: "errors.validation"`.

#### Scenario: Token name accepts up to 64 chars

- **WHEN** the client POSTs `{name: <65 chars>}`
- **THEN** the response SHALL be HTTP 400.

### Requirement: DELETE /api/account/pat/:id revokes a token via soft delete

The endpoint `DELETE /api/account/pat/:id` SHALL set `revoked_at = now()` on the targeted row when the authenticated user owns it, and return HTTP 204. Cross-user delete attempts SHALL return HTTP 404 (not 403) to avoid leaking which token IDs exist. Subsequent authentication using the revoked token SHALL fail at the PAT auth gate (returning 401).

#### Scenario: Owner deletes their own token

- **GIVEN** user U1 owns PAT with id `pat_abc`
- **WHEN** U1 calls `DELETE /api/account/pat/pat_abc`
- **THEN** the server SHALL respond with HTTP 204
- **AND** the DB row SHALL have `revoked_at IS NOT NULL`.

#### Scenario: Cross-user delete returns 404 to avoid existence leak

- **GIVEN** user U1 owns PAT `pat_abc`
- **WHEN** user U2's session calls `DELETE /api/account/pat/pat_abc`
- **THEN** the server SHALL respond with HTTP 404
- **AND** the row's `revoked_at` SHALL remain unchanged.

#### Scenario: Non-existent id returns 404

- **WHEN** an authenticated user calls `DELETE /api/account/pat/pat_does_not_exist`
- **THEN** the server SHALL respond with HTTP 404.

#### Scenario: Authenticating with a revoked token fails

- **GIVEN** PAT `P1` is revoked
- **WHEN** the client sends `Authorization: Bearer <P1 plaintext>` to `POST /api/mcp`
- **THEN** the server SHALL respond with HTTP 401.

### Requirement: PAT authenticator resolves token plaintext to user id without exposing hashes

The PAT authentication helper SHALL accept a raw `Authorization: Bearer <token>` header value, compute SHA-256 over the token plaintext, look up `personal_access_tokens` by `token_hash` where `revoked_at IS NULL` and (`expires_at IS NULL OR expires_at > NOW()`), and return the associated `user_id` on success or `null` on any failure (missing header, wrong prefix, no match, expired, revoked). The authenticator SHALL NOT log or return the plaintext token. Logging SHALL be limited to the token id (ulid) and the last 4 characters of the prefix for diagnostic purposes.

#### Scenario: Valid token resolves to user id

- **GIVEN** a PAT row with `user_id = "user_42"`, `token_hash = sha256(plaintext)`, `revoked_at IS NULL`, `expires_at` in the future
- **WHEN** the authenticator receives `Authorization: Bearer <plaintext>`
- **THEN** the authenticator SHALL return `"user_42"`.

#### Scenario: Missing Bearer prefix returns null

- **WHEN** the authenticator receives `Authorization: vlm_pat_abc...` (no `Bearer ` prefix)
- **THEN** the authenticator SHALL return `null`.

#### Scenario: Expired token returns null

- **GIVEN** a PAT row with `expires_at` in the past
- **WHEN** the authenticator receives the matching plaintext
- **THEN** the authenticator SHALL return `null`.

#### Scenario: Authenticator never logs plaintext

- **GIVEN** any incoming request
- **WHEN** the authenticator runs
- **THEN** no Pino log call SHALL include the plaintext token
- **AND** any token-related log line SHALL only reference the token id and `prefix.slice(-4)` (or similar minimum-leak identifier).

### Requirement: Settings UI presents a MCP Tokens panel for token CRUD

The Settings → API Keys page SHALL render a `MCP Tokens` section showing the user's active tokens with `name`, masked prefix (e.g. `vlm_pat_a3f2 ··· ····`), `lastUsedAt` ("2 hours ago" relative time), `expiresAt` ("Expires in 87 days" or "Never expires"), and a Revoke action. The section SHALL also provide a "Create token" affordance that opens a dialog accepting `name` (required) and `expiresInDays` choice (`30`, `90`, or `Never`). After successful creation, the dialog SHALL display the plaintext token with a warning "This is the only time you can see this token" and a Copy-to-clipboard button. Closing the dialog SHALL clear the plaintext from React state.

#### Scenario: Create-token dialog shows plaintext exactly once

- **GIVEN** a signed-in user opens the MCP Tokens section
- **WHEN** the user clicks "Create token", types a name, picks "30 days", and submits
- **THEN** the dialog SHALL display the plaintext token in a read-only input alongside a Copy button
- **AND** the dialog SHALL display a warning string sourced from i18n key `account.pat.plaintextWarning`
- **WHEN** the user closes the dialog
- **THEN** subsequent renders of the MCP Tokens section SHALL show the new token row WITHOUT the plaintext.

#### Scenario: Revoke action requires confirmation and removes the row

- **GIVEN** a token row `P1` is displayed
- **WHEN** the user clicks the Revoke icon on `P1`
- **THEN** a confirmation dialog SHALL appear
- **WHEN** the user confirms
- **THEN** the `DELETE /api/account/pat/:id` endpoint SHALL be called
- **AND** the token row SHALL disappear from the section after the request resolves.

#### Scenario: i18n keys are present in both zh-TW and en

- **GIVEN** the `packages/shared/src/locales/zh-TW.json` and `en.json` files
- **WHEN** the locale audit test runs
- **THEN** keys `account.pat.title`, `account.pat.createButton`, `account.pat.nameLabel`, `account.pat.expiresLabel`, `account.pat.expires30Days`, `account.pat.expires90Days`, `account.pat.expiresNever`, `account.pat.plaintextWarning`, `account.pat.copyButton`, `account.pat.revokeButton`, `account.pat.revokeConfirm`, `account.pat.lastUsedNever`, `account.pat.lastUsedAt`, `account.pat.expiresAt`, `account.pat.expiresNeverDisplay` SHALL be present in both files with non-empty values.
