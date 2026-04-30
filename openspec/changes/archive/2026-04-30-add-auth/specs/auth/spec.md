## ADDED Requirements

### Requirement: Google OAuth login

The system SHALL allow visitors to sign in via Google OAuth. The OAuth flow MUST follow the authorization code grant with PKCE, validate `state` and `nonce` against the originating session, and create a Vellum `users` row on first successful authentication. Subsequent sign-ins for the same Google account MUST reuse the existing user row.

#### Scenario: First-time Google sign-in creates user

- **WHEN** a visitor with no existing Vellum account completes the Google OAuth flow successfully
- **THEN** the system creates a `users` row populated from the Google profile (`email`, `name`, `image`), creates a `sessions` row, sets the `session` cookie (HttpOnly, Secure, SameSite=Lax), and redirects the client to `/dashboard`

#### Scenario: Returning Google user reuses existing account

- **WHEN** a user whose Google email matches an existing `users.email` completes the Google OAuth flow
- **THEN** the system reuses the existing `users` row, creates a new `sessions` row, sets the cookie, and redirects to `/dashboard`

#### Scenario: Google OAuth state mismatch is rejected

- **WHEN** the OAuth callback `state` parameter does not match the value stored at flow initiation
- **THEN** the system responds with HTTP 400 and an envelope `{ error: { errorKey: "auth.errors.googleOauthFailed" } }` and does NOT create a session

#### Scenario: Google OAuth provider error is surfaced

- **WHEN** Google returns an error response (`error=access_denied` or any non-2xx) at the callback
- **THEN** the system responds with HTTP 400 and `errorKey: "auth.errors.googleOauthFailed"` without creating a session or user

### Requirement: Magic Link login request

The system SHALL accept Magic Link sign-in requests at `POST /api/auth/magic-link/send` with `{ email }`. On valid input, the system MUST generate a cryptographically random single-use token, persist it with an expiration of 15 minutes, and dispatch an email containing the verification URL via the configured `EmailService`. The endpoint MUST enforce two rate-limit rules: per-email 3 requests per 10 minutes, and per-IP 10 requests per hour.

#### Scenario: Valid email sends magic link

- **WHEN** a client posts `{ "email": "user@example.com" }` to `POST /api/auth/magic-link/send` and rate-limit windows have capacity
- **THEN** the system persists a `verification_tokens` row with a 15-minute expiry, calls `EmailService.send` with the magic-link URL, and responds with HTTP 200 and `{ data: { sent: true } }`

#### Scenario: Per-email rate limit blocks 4th send within 10 minutes

- **WHEN** the same email address has already received 3 magic-link sends in the past 10 minutes
- **THEN** the system responds with HTTP 429, `{ error: { errorKey: "auth.errors.emailRateLimited" } }`, and a `Retry-After` header carrying the seconds remaining until a token frees

##### Example: per-email window

| Send sequence | Outcome |
| ------------- | ------- |
| Send 1 (T=0s) | 200 OK, token sent |
| Send 2 (T=10s) | 200 OK, token sent |
| Send 3 (T=20s) | 200 OK, token sent |
| Send 4 (T=30s) | 429, `Retry-After` ≈ 570s |
| Send 5 (T=600s+) | 200 OK, window has refilled |

#### Scenario: Per-IP rate limit blocks 11th send within an hour

- **WHEN** the same client IP has issued 10 magic-link sends across any combination of email addresses in the past hour
- **THEN** the system responds with HTTP 429 and `{ error: { errorKey: "auth.errors.ipRateLimited" } }` with a `Retry-After` header

#### Scenario: Invalid email format is rejected before rate-limit consumption

- **WHEN** a client posts `{ "email": "not-an-email" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.invalidEmail" } }` and does NOT consume rate-limit tokens

#### Scenario: Magic link token is not logged

- **WHEN** the magic-link send endpoint is invoked
- **THEN** the structured logger MUST NOT include the generated token, the email body, or the `Authorization`/`Cookie` headers in any log line

### Requirement: Magic Link verification

The system SHALL verify magic-link tokens at `GET /api/auth/magic-link/verify?token=<token>`. On successful verification, the system MUST create a `users` row for new emails (or reuse the existing one), create a `sessions` row, mark the token as used, set the session cookie, and redirect to `/dashboard`. Tokens MUST be single-use and MUST be rejected after their 15-minute expiry. The endpoint MUST enforce a per-IP rate limit of 10 attempts per minute.

#### Scenario: Valid unused token authenticates the user

- **WHEN** a client opens `GET /api/auth/magic-link/verify?token=<valid-unused-token-within-expiry>`
- **THEN** the system creates or reuses the `users` row, creates a session, marks the token as used, sets the session cookie, and responds with HTTP 302 to `/dashboard`

#### Scenario: Expired token is rejected

- **WHEN** a client opens the verify URL with a token whose `expires_at` is in the past
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.magicLinkExpired" } }` without creating a session

#### Scenario: Already-used token is rejected

- **WHEN** a client opens the verify URL with a token whose `used_at` is non-null
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.invalidCredentials" } }` without creating a session

#### Scenario: Unknown token is rejected

- **WHEN** a client opens the verify URL with a token that has no matching `verification_tokens` row
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "auth.errors.invalidCredentials" } }`

#### Scenario: Per-IP verify rate limit blocks 11th attempt within a minute

- **WHEN** the same IP has made 10 verify attempts in the past 60 seconds
- **THEN** the system responds with HTTP 429, `{ error: { errorKey: "auth.errors.ipRateLimited" } }`, and a `Retry-After` header

### Requirement: Logout

The system SHALL terminate the current session at `POST /api/auth/logout`. The endpoint MUST delete the `sessions` row identified by the request cookie, clear the `session` cookie via `Set-Cookie` with `Max-Age=0`, and respond with HTTP 200.

#### Scenario: Logout clears session and cookie

- **WHEN** an authenticated client posts to `POST /api/auth/logout`
- **THEN** the system deletes the `sessions` row, returns `Set-Cookie: session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, and responds `{ data: { ok: true } }`

#### Scenario: Logout without session is idempotent

- **WHEN** an unauthenticated client posts to `POST /api/auth/logout`
- **THEN** the system responds with HTTP 200 and `{ data: { ok: true } }` without error and emits a `Set-Cookie` header clearing the cookie

### Requirement: Session cookie configuration

The system SHALL set the session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/` attributes. The cookie value MUST be the session id; the value MUST NOT include the user id, email, or any verification token.

#### Scenario: Cookie attributes are present on every login response

- **WHEN** any login endpoint (`/api/auth/google/callback`, `/api/auth/magic-link/verify`) creates a session
- **THEN** the response `Set-Cookie` header includes `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`

### Requirement: Protected route guard

The system SHALL reject access to `/api/account/*` and any other authenticated endpoints when no valid session cookie is present. The web application SHALL redirect unauthenticated visitors of `/dashboard`, `/canvas/*`, `/account/*`, and any other protected client routes to `/login`.

#### Scenario: API request without session is rejected

- **WHEN** a client without a session cookie sends a request to `GET /api/account/profile`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "auth.errors.notAuthenticated" } }`

#### Scenario: API request with revoked session is rejected

- **WHEN** a client whose `sessions` row has been deleted or whose `revoked_at` is set sends a request to `GET /api/account/profile`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "auth.errors.sessionRevoked" } }`

#### Scenario: Web app redirects unauthenticated user to login

- **WHEN** an unauthenticated client navigates to `/dashboard` in the web application
- **THEN** the application redirects to `/login` and preserves the original target as a `?redirect=<path>` search parameter

### Requirement: Server-returned error keys (i18n contract)

The system SHALL return failure responses with the envelope `{ error: { errorKey: <string> } }` where `errorKey` is an i18next dot-notation key. The system MUST NOT return localized human-readable error strings on the API surface.

#### Scenario: Failure response uses errorKey

- **WHEN** any auth endpoint returns a non-2xx response
- **THEN** the response body matches the schema `{ error: { errorKey: string, details?: object } }` and the `errorKey` value resolves to a key present in BOTH `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`

##### Example: errorKey set required by this spec

| errorKey | When raised |
| -------- | ----------- |
| auth.errors.invalidEmail | Magic-link send with malformed email |
| auth.errors.invalidCredentials | Unknown or used magic-link token |
| auth.errors.magicLinkExpired | Magic-link token past 15-minute expiry |
| auth.errors.googleOauthFailed | Google OAuth state mismatch or provider error |
| auth.errors.emailRateLimited | Per-email magic-link send window exceeded |
| auth.errors.ipRateLimited | Per-IP magic-link send or login attempt window exceeded |
| auth.errors.notAuthenticated | Protected endpoint without session cookie |
| auth.errors.sessionRevoked | Protected endpoint with deleted/revoked session |
| auth.errors.magicLinkSendFailed | EmailService throws while sending magic link |
