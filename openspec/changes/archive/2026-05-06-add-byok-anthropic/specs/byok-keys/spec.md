## ADDED Requirements

### Requirement: Encrypted storage of provider API keys

The system SHALL store user-supplied LLM provider API keys in the `api_keys` table with the columns `user_id` (text foreign key to `users.id` with `ON DELETE CASCADE`), `provider` (text), `encrypted_key` (text), `created_at` (timestamptz with server default `NOW()`), and `last_used_at` (timestamptz nullable). The system MUST enforce uniqueness on the composite key `(user_id, provider)` so that each user has at most one stored key per provider. Plaintext API keys MUST NOT be persisted to the database under any circumstance.

#### Scenario: Saving a new key inserts a row

- **WHEN** an authenticated user saves a validated Anthropic key
- **THEN** the system inserts one row into `api_keys` with `user_id` matching the session subject, `provider = 'anthropic'`, `encrypted_key` populated with the AES-256-GCM packed ciphertext, `created_at = NOW()`, and `last_used_at = NULL`

#### Scenario: Saving a second key for the same provider replaces the first

- **WHEN** an authenticated user with an existing Anthropic key saves a new validated Anthropic key
- **THEN** the system updates the existing row in place using upsert semantics on `(user_id, provider)` and the `encrypted_key` column reflects the new ciphertext

#### Scenario: User deletion cascades to api_keys

- **WHEN** a user row is deleted from the `users` table
- **THEN** all matching rows in `api_keys` for that `user_id` are removed automatically by the foreign-key cascade

### Requirement: AES-256-GCM API Key Vault

The system SHALL provide an API Key Vault module that exposes `encryptApiKey(plaintext: string): string` and `decryptApiKey(packed: string): string`. The vault MUST use AES-256-GCM via `node:crypto`. Each call to `encryptApiKey` MUST generate a fresh 12-byte cryptographically random initialization vector (IV) using `crypto.randomBytes(12)`. The packed format MUST be `base64(iv ‖ tag ‖ ciphertext)` where `tag` is the 16-byte GCM authentication tag. The vault MUST NOT cache or reuse IVs across encryption calls.

#### Scenario: Encrypt then decrypt round-trips

- **WHEN** the vault encrypts a plaintext string and then decrypts the resulting packed value
- **THEN** the decrypted output equals the original plaintext byte-for-byte

##### Example: round-trip a typical Anthropic key

- **GIVEN** plaintext `"sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"`
- **WHEN** `decryptApiKey(encryptApiKey(plaintext))` is invoked
- **THEN** the returned string equals the original plaintext exactly

#### Scenario: Same plaintext produces different ciphertext on every call

- **WHEN** the vault encrypts the identical plaintext multiple times
- **THEN** every resulting packed value is distinct because each call generates a unique random IV

##### Example: 100 distinct ciphertexts for one plaintext

- **GIVEN** plaintext `"sk-ant-test-1234567890"`
- **WHEN** `encryptApiKey` is called 100 times with that plaintext
- **THEN** the resulting set of 100 packed strings has cardinality 100 (no duplicates) and the IV-portion of each packed value is unique

#### Scenario: Tampered ciphertext fails authentication

- **WHEN** the vault attempts to decrypt a packed value whose ciphertext bytes have been altered after encryption
- **THEN** decryption throws an error and no plaintext is returned

##### Example: flipped byte rejected by GCM auth tag

- **GIVEN** `packed = encryptApiKey("sk-ant-test")` and `tampered` is `packed` with the final base64 byte replaced by a different valid base64 character
- **WHEN** `decryptApiKey(tampered)` is invoked
- **THEN** the call throws (GCM authentication failure) and no value is returned

### Requirement: Master key sourced from environment with startup validation

The system SHALL read the AES-256-GCM master key from the environment variable `API_KEY_ENCRYPTION_KEY`. The variable's value MUST be a 64-character hexadecimal string that decodes to exactly 32 bytes (256 bits). The system MUST validate the master key on server startup and refuse to start when the variable is missing, when the value is not valid hex, or when the decoded length is not 32 bytes.

#### Scenario: Missing variable blocks startup

- **WHEN** the API server starts with `API_KEY_ENCRYPTION_KEY` unset
- **THEN** vault initialization throws an error and the server process exits non-zero before accepting requests

#### Scenario: Wrong-length value blocks startup

- **WHEN** the API server starts with `API_KEY_ENCRYPTION_KEY` set to a hex string that decodes to fewer than 32 or more than 32 bytes
- **THEN** vault initialization throws an error and the server process exits non-zero before accepting requests

##### Example: invalid master key inputs

| Value | Decoded bytes | Outcome |
| ----- | ------------- | ------- |
| (unset) | n/a | startup error: `API_KEY_ENCRYPTION_KEY is required` |
| `"abc"` | 1 (after pad) or invalid | startup error: invalid hex or wrong length |
| `"00".repeat(31)` (62 chars) | 31 | startup error: must be 32 bytes |
| `"00".repeat(33)` (66 chars) | 33 | startup error: must be 32 bytes |
| `"00".repeat(32)` (64 chars) | 32 | startup succeeds |

### Requirement: Provider Adapter strategy interface

The system SHALL define a `ProviderAdapter` interface with the method `validateKey(plaintext: string): Promise<{ ok: true } | { ok: false, errorKey: string }>`. The system SHALL register one adapter per supported provider in a `Record<ProviderId, ProviderAdapter>` lookup table. The current `ProviderId` literal type MUST contain only `'anthropic'`. New providers (OpenAI, Google) SHALL be added by extending the `ProviderId` type and registering additional adapter instances without modifying existing route handlers.

#### Scenario: Route handler resolves adapter via lookup

- **WHEN** a save request arrives for provider `'anthropic'`
- **THEN** the route handler retrieves the adapter from the registry by provider id and calls `validateKey(plaintext)` without any provider-specific branching in the handler itself

#### Scenario: Unknown provider id is rejected before adapter lookup

- **WHEN** a request arrives with a `:provider` path parameter that is not in the `ProviderId` literal type
- **THEN** the request is rejected with HTTP 400 and `{ error: { errorKey: "errors.byok.providerUnknown" } }` and no adapter is invoked

### Requirement: Anthropic key validation via vendor ping

The Anthropic provider adapter SHALL validate a candidate key by sending a single POST request to `${ANTHROPIC_API_BASE_URL}/v1/messages` (default base URL `https://api.anthropic.com`) with the body `{"model": "claude-haiku-4-5", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}`, the headers `x-api-key: <plaintext>` and `anthropic-version: 2023-06-01`, and a 5-second abort timeout. The adapter MUST translate the response into an `errorKey` according to the table below.

#### Scenario: Successful validation returns ok

- **WHEN** the Anthropic API responds with HTTP 200 or 201
- **THEN** the adapter returns `{ ok: true }`

#### Scenario: HTTP status maps to errorKey

- **WHEN** the Anthropic API responds with a non-2xx status or the request fails at the network layer
- **THEN** the adapter returns `{ ok: false, errorKey }` according to the mapping table

##### Example: status to errorKey mapping

| HTTP outcome | errorKey |
| ------------ | -------- |
| 401 | `errors.byok.invalidKey` |
| 402 | `errors.byok.outOfCredits` |
| 429 | `errors.byok.rateLimited` |
| 500 / 502 / 503 / 504 | `errors.byok.unreachable` |
| Other 4xx (400, 403, 404, 422, etc.) | `errors.byok.unreachable` |
| Network error (DNS failure, ECONNREFUSED) | `errors.byok.unreachable` |
| Timeout (>5 seconds, AbortSignal fires) | `errors.byok.unreachable` |

#### Scenario: Validation timeout is enforced

- **WHEN** the Anthropic API does not respond within 5 seconds
- **THEN** the adapter aborts the fetch via `AbortSignal.timeout(5000)` and returns `{ ok: false, errorKey: "errors.byok.unreachable" }`

### Requirement: List configured BYOK providers

The system SHALL expose `GET /api/account/byok` that returns the list of providers configured by the authenticated user. The response MUST include `provider`, `createdAt`, and `lastUsedAt` for each row but MUST NOT include the encrypted key value or any derivative of the plaintext key. The endpoint MUST require an authenticated session and MUST be rate-limited to 60 requests per minute per session.

#### Scenario: Authenticated list returns configured providers only

- **WHEN** an authenticated user with one Anthropic key saved sends `GET /api/account/byok`
- **THEN** the system responds with HTTP 200 and `{ data: [{ provider: "anthropic", createdAt: <iso>, lastUsedAt: null }] }`

#### Scenario: Authenticated list returns empty array when no keys exist

- **WHEN** an authenticated user with no saved keys sends `GET /api/account/byok`
- **THEN** the system responds with HTTP 200 and `{ data: [] }`

#### Scenario: Unauthenticated request rejected

- **WHEN** a client without a valid session sends `GET /api/account/byok`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "errors.byok.notAuthenticated" } }`

#### Scenario: Rate limit enforced per session

- **WHEN** an authenticated session sends a 61st `GET /api/account/byok` within one minute
- **THEN** the system responds with HTTP 429, includes a `Retry-After` header in seconds, and `{ error: { errorKey: "errors.rateLimit.exceeded" } }`

### Requirement: Save BYOK provider key with validate-before-persist

The system SHALL expose `POST /api/account/byok/:provider` that accepts a JSON body `{ apiKey: string }`. The endpoint MUST require an authenticated session and MUST be rate-limited to 10 requests per minute per session. The endpoint MUST validate the candidate key by invoking the corresponding `ProviderAdapter` BEFORE persisting any data. On validation failure, no row MUST be inserted or modified. On validation success, the system MUST encrypt the plaintext via the API Key Vault and upsert the row using the unique constraint on `(user_id, provider)`.

#### Scenario: Successful validation persists the encrypted key

- **WHEN** an authenticated user POSTs a valid Anthropic key
- **THEN** the provider adapter returns `{ ok: true }`, the vault encrypts the plaintext, the system upserts a row in `api_keys`, and the endpoint responds with HTTP 200 and `{ data: { provider: "anthropic", createdAt: <iso> } }`

#### Scenario: Failed validation does not persist

- **WHEN** an authenticated user POSTs an invalid Anthropic key
- **THEN** the provider adapter returns `{ ok: false, errorKey: "errors.byok.invalidKey" }`, no row is inserted or updated in `api_keys`, and the endpoint responds with HTTP 400 and `{ error: { errorKey: "errors.byok.invalidKey" } }`

#### Scenario: Saved key is encrypted at rest

- **WHEN** an authenticated user successfully saves an Anthropic key
- **THEN** the value stored in the `api_keys.encrypted_key` column does not equal the plaintext input and decoding it as base64 yields a binary blob of at least 28 bytes (12 IV + 16 tag + at least 0 ciphertext)

#### Scenario: Replacing an existing key updates in place

- **WHEN** an authenticated user with a saved Anthropic key POSTs a different valid Anthropic key
- **THEN** exactly one row exists in `api_keys` for `(user_id, 'anthropic')`, its `encrypted_key` reflects the new ciphertext, and `created_at` is refreshed to the time of the latest save

#### Scenario: Invalid request body rejected before adapter call

- **WHEN** an authenticated user POSTs a body where `apiKey` is missing, empty, shorter than 8 characters, or longer than 512 characters
- **THEN** the system responds with HTTP 400 and an `errorKey` indicating validation failure, and no provider adapter is invoked

#### Scenario: Save endpoint rate-limit enforced

- **WHEN** an authenticated session sends an 11th `POST /api/account/byok/anthropic` within one minute
- **THEN** the system responds with HTTP 429, includes a `Retry-After` header, and no adapter call is performed

### Requirement: Delete BYOK provider key

The system SHALL expose `DELETE /api/account/byok/:provider` that removes the row identified by the authenticated user's id and the path provider. The endpoint MUST require an authenticated session and MUST be rate-limited to 30 requests per minute per session. The endpoint MUST be idempotent.

#### Scenario: Delete removes the row

- **WHEN** an authenticated user with a saved Anthropic key sends `DELETE /api/account/byok/anthropic`
- **THEN** the row matching `(user_id, 'anthropic')` is removed from `api_keys` and the endpoint responds with HTTP 204

#### Scenario: Delete with no row is idempotent

- **WHEN** an authenticated user with no saved Anthropic key sends `DELETE /api/account/byok/anthropic`
- **THEN** the database is unchanged and the endpoint responds with HTTP 204

#### Scenario: Delete only affects the calling user

- **WHEN** user A sends `DELETE /api/account/byok/anthropic` while user B has a saved Anthropic key
- **THEN** user A's row (if any) is removed and user B's row remains untouched

### Requirement: Server returns errorKey, never translated text

The system SHALL respond with `{ error: { errorKey: <string> } }` on every BYOK API failure. The `errorKey` value MUST be a dot-notation i18n key (for example `errors.byok.invalidKey`) and MUST NOT be a pre-translated user-facing string. The frontend SHALL look up the key in the i18n catalog before display.

#### Scenario: Validation failure returns errorKey

- **WHEN** any BYOK endpoint emits a failure response
- **THEN** the JSON body contains `error.errorKey` as a dot-notation key string and the body does NOT contain a pre-translated `error.message` field

### Requirement: BYOK i18n catalog populated for both supported locales

The system SHALL include translations for every `errors.byok.*` and `account.apiKeys.*` key in both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`. The two files MUST have identical key trees within these subtrees; no key SHALL exist in one file without a corresponding entry in the other.

#### Scenario: Both locales contain every BYOK key

- **WHEN** the i18n audit compares the keys under `errors.byok` and `account.apiKeys` in `zh-TW.json` and `en.json`
- **THEN** the two key sets are identical

##### Example: required keys

| Key | Required in zh-TW | Required in en |
| --- | ----------------- | -------------- |
| `errors.byok.invalidKey` | yes | yes |
| `errors.byok.outOfCredits` | yes | yes |
| `errors.byok.rateLimited` | yes | yes |
| `errors.byok.unreachable` | yes | yes |
| `errors.byok.providerUnknown` | yes | yes |
| `errors.byok.notAuthenticated` | yes | yes |
| `account.apiKeys.title` | yes | yes |
| `account.apiKeys.subtitle` | yes | yes |
| `account.apiKeys.providers.anthropic.label` | yes | yes |
| `account.apiKeys.providers.anthropic.placeholder` | yes | yes |
| `account.apiKeys.providers.anthropic.helpUrl` | yes | yes |
| `account.apiKeys.actions.save` | yes | yes |
| `account.apiKeys.actions.delete` | yes | yes |
| `account.apiKeys.actions.replace` | yes | yes |
| `account.apiKeys.status.saving` | yes | yes |
| `account.apiKeys.status.saved` | yes | yes |
| `account.apiKeys.confirm.deleteTitle` | yes | yes |
| `account.apiKeys.confirm.deleteBody` | yes | yes |

### Requirement: Settings API Keys page UI

The system SHALL provide a Settings → API Keys page at the route `/account/api-keys` that is protected by the existing authentication route guard. The page SHALL display a single Anthropic provider row. When no key is saved, the row MUST show a password-type input field, a Save button that is disabled until input is non-empty, and a help link to the Anthropic console. When a key is saved, the row MUST show a masked indicator that does NOT reveal the original plaintext, a Delete button, and a Replace button that returns the row to the input-and-Save state. All visible strings MUST be rendered through `t('key')`.

#### Scenario: Unauthenticated visit redirects to login

- **WHEN** an unauthenticated client navigates to `/account/api-keys`
- **THEN** the route guard redirects to `/login` before any BYOK API call is made

#### Scenario: Empty state shows input and disabled Save

- **WHEN** an authenticated user with no saved Anthropic key opens `/account/api-keys`
- **THEN** the Anthropic row shows an empty password input, a Save button in disabled state, and the input placeholder is the value of `t('account.apiKeys.providers.anthropic.placeholder')`

#### Scenario: Save success transitions to saved state

- **WHEN** the user enters a candidate key and clicks Save and the server returns 200
- **THEN** the row replaces the input with a masked indicator and shows Delete and Replace buttons

#### Scenario: Save failure surfaces translated errorKey

- **WHEN** the server responds with `{ error: { errorKey: "errors.byok.invalidKey" } }`
- **THEN** the UI displays the result of `t('errors.byok.invalidKey')` adjacent to the input, and the input retains the user's value (it is NOT cleared)

#### Scenario: Delete returns row to empty state

- **WHEN** the user clicks Delete and confirms the dialog and the server returns 204
- **THEN** the row returns to the empty state with input field and disabled Save button
