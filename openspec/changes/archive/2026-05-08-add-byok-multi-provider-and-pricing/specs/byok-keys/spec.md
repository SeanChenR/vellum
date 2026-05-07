## MODIFIED Requirements

### Requirement: Provider Adapter strategy interface

The system SHALL define a `ProviderAdapter` interface with the method `validateKey(plaintext: string): Promise<{ ok: true } | { ok: false, errorKey: string }>`. The system SHALL register one adapter per supported provider in a `Record<ProviderId, ProviderAdapter>` lookup table. The `ProviderId` literal type MUST be `'anthropic' | 'openai' | 'google'`. The lookup table MUST contain an adapter entry for each member of the `ProviderId` union, and the TypeScript type system MUST enforce this completeness so that omitting any entry causes a compilation error.

#### Scenario: Route handler resolves adapter via lookup for any supported provider

- **WHEN** a save request arrives for any provider in `'anthropic' | 'openai' | 'google'`
- **THEN** the route handler retrieves the adapter from the registry by provider id and calls `validateKey(plaintext)` without any provider-specific branching in the handler itself

#### Scenario: Unknown provider id is rejected before adapter lookup

- **WHEN** a request arrives with a `:provider` path parameter that is not in the `ProviderId` literal type
- **THEN** the request is rejected with HTTP 400 and `{ error: { errorKey: "errors.byok.providerUnknown" } }` and no adapter is invoked

#### Scenario: Adapter registry is exhaustive at compile time

- **WHEN** the source declares the adapter registry as `Record<ProviderId, ProviderAdapter>`
- **THEN** any commit that omits an adapter for one of `'anthropic'`, `'openai'`, or `'google'` MUST fail TypeScript compilation before tests run

### Requirement: Save BYOK provider key with validate-before-persist

The system SHALL expose `POST /api/account/byok/:provider` that accepts a JSON body `{ apiKey: string }` for any provider in `'anthropic' | 'openai' | 'google'`. The endpoint MUST require an authenticated session and MUST be rate-limited to 10 requests per minute per session. The endpoint MUST validate the candidate key by invoking the corresponding `ProviderAdapter` BEFORE persisting any data. On validation failure, no row MUST be inserted or modified. On validation success, the system MUST encrypt the plaintext via the API Key Vault and upsert the row using the unique constraint on `(user_id, provider)`.

#### Scenario: Successful validation persists the encrypted key for any supported provider

- **WHEN** an authenticated user POSTs a valid key for any of `'anthropic'`, `'openai'`, or `'google'`
- **THEN** the corresponding provider adapter returns `{ ok: true }`, the vault encrypts the plaintext, the system upserts a row in `api_keys`, and the endpoint responds with HTTP 200 and `{ data: { provider: <id>, createdAt: <iso> } }`

#### Scenario: Failed validation does not persist

- **WHEN** an authenticated user POSTs an invalid key for any supported provider
- **THEN** the provider adapter returns `{ ok: false, errorKey: "errors.byok.invalidKey" }`, no row is inserted or updated in `api_keys`, and the endpoint responds with HTTP 400 and `{ error: { errorKey: "errors.byok.invalidKey" } }`

#### Scenario: Saved key is encrypted at rest

- **WHEN** an authenticated user successfully saves a key for any supported provider
- **THEN** the value stored in the `api_keys.encrypted_key` column does not equal the plaintext input and decoding it as base64 yields a binary blob of at least 28 bytes (12 IV + 16 tag + at least 0 ciphertext)

#### Scenario: Replacing an existing key updates in place

- **WHEN** an authenticated user with a saved key for a given provider POSTs a different valid key for that same provider
- **THEN** exactly one row exists in `api_keys` for `(user_id, provider)`, its `encrypted_key` reflects the new ciphertext, and `created_at` is refreshed to the time of the latest save

#### Scenario: Keys for different providers are independent

- **WHEN** an authenticated user has saved keys for `'anthropic'` and POSTs a new key for `'openai'`
- **THEN** the system inserts a new row for `(user_id, 'openai')`, the existing `(user_id, 'anthropic')` row is unchanged, and both rows coexist

#### Scenario: Invalid request body rejected before adapter call

- **WHEN** an authenticated user POSTs a body where `apiKey` is missing, empty, shorter than 8 characters, or longer than 512 characters
- **THEN** the system responds with HTTP 400 and an `errorKey` indicating validation failure, and no provider adapter is invoked

#### Scenario: Save endpoint rate-limit enforced

- **WHEN** an authenticated session sends an 11th `POST /api/account/byok/<provider>` within one minute (regardless of which provider)
- **THEN** the system responds with HTTP 429, includes a `Retry-After` header, and no adapter call is performed

### Requirement: List configured BYOK providers

The system SHALL expose `GET /api/account/byok` that returns the providers configured by the authenticated user together with the user's persisted per-provider default-model preferences. The response body MUST be `{ data: { keys: Array<{ provider, createdAt, lastUsedAt }>, preferences: Partial<Record<ProviderId, { model, updatedAt }>> } }`. The `preferences` field MUST be an object whose keys are members of `'anthropic' | 'openai' | 'google'`; a missing key means "no preference set for that provider", and an empty `{}` is the empty-state shape (NOT `null`). The response MUST NOT include any encrypted key value or any derivative of any plaintext key. The endpoint MUST require an authenticated session and MUST be rate-limited to 60 requests per minute per session.

#### Scenario: Authenticated list returns configured providers and per-provider preferences

- **WHEN** an authenticated user with one Anthropic key saved and a stored preference of `(anthropic, claude-haiku-4-5)` sends `GET /api/account/byok`
- **THEN** the system responds with HTTP 200 and `{ data: { keys: [{ provider: "anthropic", createdAt: <iso>, lastUsedAt: null }], preferences: { anthropic: { model: "claude-haiku-4-5", updatedAt: <iso> } } } }`

#### Scenario: Multiple per-provider preferences coexist in the response

- **WHEN** an authenticated user has stored preferences for both `'anthropic'` and `'openai'`
- **THEN** the system responds with HTTP 200 and `data.preferences` contains both the `anthropic` and `openai` keys, each with its own `model` and `updatedAt`; providers without a preference are absent from the object

#### Scenario: Authenticated list returns empty keys array and empty preferences object when nothing is configured

- **WHEN** an authenticated user with no saved keys and no stored preference sends `GET /api/account/byok`
- **THEN** the system responds with HTTP 200 and `{ data: { keys: [], preferences: {} } }`

#### Scenario: Authenticated list returns keys and empty preferences when only keys exist

- **WHEN** an authenticated user has saved keys for `'openai'` and `'google'` but has never set a preference
- **THEN** the system responds with HTTP 200 and `{ data: { keys: [<openai row>, <google row>], preferences: {} } }`

#### Scenario: Unauthenticated request rejected

- **WHEN** a client without a valid session sends `GET /api/account/byok`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "errors.byok.notAuthenticated" } }`

#### Scenario: Rate limit enforced per session

- **WHEN** an authenticated session sends a 61st `GET /api/account/byok` within one minute
- **THEN** the system responds with HTTP 429, includes a `Retry-After` header in seconds, and `{ error: { errorKey: "errors.rateLimit.exceeded" } }`

### Requirement: BYOK i18n catalog populated for both supported locales

The system SHALL include translations for every `errors.byok.*` and `account.apiKeys.*` key in both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json`. The two files MUST have identical key trees within these subtrees; no key SHALL exist in one file without a corresponding entry in the other. The catalog MUST include entries for all three providers (`anthropic`, `openai`, `google`), pricing-table column / tier labels, the default-model picker labels, and the `errors.byok.invalidPreference` error key.

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
| `errors.byok.invalidPreference` | yes | yes |
| `account.apiKeys.title` | yes | yes |
| `account.apiKeys.subtitle` | yes | yes |
| `account.apiKeys.providers.anthropic.label` | yes | yes |
| `account.apiKeys.providers.anthropic.placeholder` | yes | yes |
| `account.apiKeys.providers.anthropic.helpUrl` | yes | yes |
| `account.apiKeys.providers.openai.label` | yes | yes |
| `account.apiKeys.providers.openai.placeholder` | yes | yes |
| `account.apiKeys.providers.openai.helpUrl` | yes | yes |
| `account.apiKeys.providers.google.label` | yes | yes |
| `account.apiKeys.providers.google.placeholder` | yes | yes |
| `account.apiKeys.providers.google.helpUrl` | yes | yes |
| `account.apiKeys.actions.save` | yes | yes |
| `account.apiKeys.actions.delete` | yes | yes |
| `account.apiKeys.actions.replace` | yes | yes |
| `account.apiKeys.status.saving` | yes | yes |
| `account.apiKeys.status.saved` | yes | yes |
| `account.apiKeys.confirm.deleteTitle` | yes | yes |
| `account.apiKeys.confirm.deleteBody` | yes | yes |
| `account.apiKeys.pricing.title` | yes | yes |
| `account.apiKeys.pricing.subtitle` | yes | yes |
| `account.apiKeys.pricing.tier.flagship` | yes | yes |
| `account.apiKeys.pricing.tier.balanced` | yes | yes |
| `account.apiKeys.pricing.tier.economy` | yes | yes |
| `account.apiKeys.pricing.column.provider` | yes | yes |
| `account.apiKeys.pricing.column.tier` | yes | yes |
| `account.apiKeys.pricing.column.model` | yes | yes |
| `account.apiKeys.pricing.column.inputCost` | yes | yes |
| `account.apiKeys.pricing.column.outputCost` | yes | yes |
| `account.apiKeys.pricing.column.link` | yes | yes |
| `account.apiKeys.defaultModel.title` | yes | yes |
| `account.apiKeys.defaultModel.subtitle` | yes | yes |
| `account.apiKeys.defaultModel.unset` | yes | yes |

### Requirement: Settings API Keys page UI

The system SHALL provide a Settings → API Keys page at the route `/account/api-keys` that is protected by the existing authentication route guard. The page SHALL render one row per provider for `'anthropic'`, `'openai'`, and `'google'` using a single shared `ApiKeyRow` component driven by a static provider list. Each row MUST behave identically: when no key is saved for that provider, the row MUST show a password-type input field, a Save button that is disabled until input is non-empty, and a help link to the provider's console; when a key is saved, the row MUST show a masked indicator that does NOT reveal the original plaintext, a Delete button, and a Replace button that returns the row to the input-and-Save state. The page SHALL also render a static pricing table with nine rows (three providers times three tiers) and a default-model picker. All visible strings MUST be rendered through `t('key')`.

#### Scenario: Unauthenticated visit redirects to login

- **WHEN** an unauthenticated client navigates to `/account/api-keys`
- **THEN** the route guard redirects to `/login` before any BYOK API call is made

#### Scenario: Page renders one row per provider

- **WHEN** an authenticated user opens `/account/api-keys`
- **THEN** the page renders exactly three provider rows in this order: Anthropic, OpenAI, Google, each with the empty-or-saved state derived from the response of `GET /api/account/byok`

#### Scenario: Empty state shows input and disabled Save for any provider

- **WHEN** an authenticated user with no saved key for a given provider sees that provider's row
- **THEN** the row shows an empty password input, a Save button in disabled state, and the input placeholder is the value of `t('account.apiKeys.providers.<provider>.placeholder')`

#### Scenario: Save success transitions one row to saved state without affecting other rows

- **WHEN** the user enters a candidate key for one provider, clicks Save, and the server returns 200
- **THEN** that provider's row replaces the input with a masked indicator and shows Delete and Replace buttons; the other two provider rows are unchanged

#### Scenario: Save failure surfaces translated errorKey

- **WHEN** the server responds with `{ error: { errorKey: "errors.byok.invalidKey" } }` for any provider
- **THEN** the UI displays the result of `t('errors.byok.invalidKey')` adjacent to that provider's input, and the input retains the user's value (it is NOT cleared)

#### Scenario: Delete returns a row to empty state

- **WHEN** the user clicks Delete on any provider row, confirms the dialog, and the server returns 204
- **THEN** that row returns to the empty state with input field and disabled Save button; the other rows are unchanged

#### Scenario: Pricing table groups by provider with no repeated provider name

- **WHEN** the page renders the pricing area
- **THEN** the pricing area contains exactly three provider sections (Anthropic, OpenAI, Google), each with the provider's name and vendor pricing link rendered once at the section header, followed by exactly three data rows per section showing tier label, model id, input cost per 1M tokens, and output cost per 1M tokens — for nine total data rows across the page

#### Scenario: Default-model selector is a dropdown embedded in each provider's row

- **WHEN** the page renders an `ApiKeyRow` for any supported provider
- **THEN** that row exposes a dropdown (`<select>` / native combobox) labelled via `t('account.apiKeys.defaultModel.title')` whose options are exactly that provider's three tier choices (flagship / balanced / economy) plus an unset placeholder option labelled `t('account.apiKeys.defaultModel.unset')`; the dropdown writes only that provider's preference

#### Scenario: Per-row dropdown reflects stored preference

- **WHEN** the user has a stored preference for a given provider returned by `GET /api/account/byok`
- **THEN** that provider's dropdown preselects the matching tier option; rows for providers without a stored preference render with the unset placeholder option selected

#### Scenario: Changing one provider's dropdown does not affect other providers

- **WHEN** the user changes the dropdown selection on the Anthropic row
- **THEN** the system PATCHes only the `'anthropic'` preference; OpenAI and Google row dropdowns retain their previous values

## ADDED Requirements

### Requirement: User-menu entry for the API Keys page

The system SHALL expose a navigation entry to `/account/api-keys` from the authenticated user-avatar menu (`UserAvatarMenu`) so authenticated users can reach the API Keys page from the dashboard or in-canvas top bar without typing the URL. The entry MUST sit alongside the existing Profile and Sessions entries, MUST be labelled via the i18n key `nav.userMenu.apiKeys`, and MUST be present in both supported locales (zh-TW + en).

#### Scenario: User-menu lists API Keys entry

- **WHEN** an authenticated user opens the user-avatar menu
- **THEN** the menu lists an "API keys" item alongside the Profile and Active sessions items, labelled via `t('nav.userMenu.apiKeys')`, and clicking the item navigates the browser to `/account/api-keys`

### Requirement: OpenAI key validation via vendor ping

The OpenAI provider adapter SHALL validate a candidate key by sending a single POST request to `${OPENAI_API_BASE_URL}/v1/chat/completions` (default base URL `https://api.openai.com`) with the body `{"model": "gpt-5-nano", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}`, the header `Authorization: Bearer <plaintext>`, and a 5-second abort timeout. The adapter MUST translate the response into an `errorKey` according to the table below.

#### Scenario: Successful validation returns ok

- **WHEN** the OpenAI API responds with HTTP 200 or 201
- **THEN** the adapter returns `{ ok: true }`

#### Scenario: HTTP status maps to errorKey

- **WHEN** the OpenAI API responds with a non-2xx status or the request fails at the network layer
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

- **WHEN** the OpenAI API does not respond within 5 seconds
- **THEN** the adapter aborts the fetch via `AbortSignal.timeout(5000)` and returns `{ ok: false, errorKey: "errors.byok.unreachable" }`

#### Scenario: Auth header carries the plaintext key

- **WHEN** the adapter issues the validation request
- **THEN** the outgoing HTTP request carries `Authorization: Bearer <plaintext>` and no other auth header

### Requirement: Google Gemini key validation via vendor ping

The Google provider adapter SHALL validate a candidate key by sending a single GET request to `${GOOGLE_API_BASE_URL}/v1beta/models?key=<plaintext>` (default base URL `https://generativelanguage.googleapis.com`) with a 5-second abort timeout. The adapter MUST translate the response into an `errorKey` according to the table below.

#### Scenario: Successful validation returns ok

- **WHEN** the Google API responds with HTTP 200
- **THEN** the adapter returns `{ ok: true }`

#### Scenario: HTTP status maps to errorKey

- **WHEN** the Google API responds with a non-2xx status or the request fails at the network layer
- **THEN** the adapter returns `{ ok: false, errorKey }` according to the mapping table

##### Example: status to errorKey mapping

| HTTP outcome | errorKey |
| ------------ | -------- |
| 400 | `errors.byok.invalidKey` |
| 401 | `errors.byok.invalidKey` |
| 403 | `errors.byok.invalidKey` |
| 429 | `errors.byok.rateLimited` |
| 402 | `errors.byok.outOfCredits` |
| 500 / 502 / 503 / 504 | `errors.byok.unreachable` |
| Other 4xx (404, 422, etc.) | `errors.byok.unreachable` |
| Network error (DNS failure, ECONNREFUSED) | `errors.byok.unreachable` |
| Timeout (>5 seconds, AbortSignal fires) | `errors.byok.unreachable` |

#### Scenario: Validation timeout is enforced

- **WHEN** the Google API does not respond within 5 seconds
- **THEN** the adapter aborts the fetch via `AbortSignal.timeout(5000)` and returns `{ ok: false, errorKey: "errors.byok.unreachable" }`

#### Scenario: Auth uses query-param, not header

- **WHEN** the adapter issues the validation request
- **THEN** the outgoing URL contains the query parameter `key=<plaintext>` and the request carries no `Authorization` header

### Requirement: BYOK pricing catalog as a static module

The system SHALL provide a static pricing catalog module at `packages/shared/src/byok-pricing.ts` that exports a readonly array `BYOK_PRICING` of nine entries representing three providers times three tiers. Each entry MUST contain: `providerId` (one of `'anthropic' | 'openai' | 'google'`), `tier` (one of `'flagship' | 'balanced' | 'economy'`), `modelId` (the canonical model identifier used by adapters and agent runtime), `inputUsdPer1M` (number), `outputUsdPer1M` (number), and `vendorPricingUrl` (string). The module MUST also export `getPricingForModel(modelId: string): PricingRow | undefined` and `isKnownModel(modelId: string): boolean`. The pricing catalog MUST be the single source of truth consumed by the Settings UI pricing table, the preferences validator, and any future agent runtime model lookup.

#### Scenario: Catalog covers nine model rows across three providers and three tiers

- **WHEN** any consumer reads `BYOK_PRICING`
- **THEN** the array length is exactly 9, every `providerId` in `'anthropic' | 'openai' | 'google'` appears exactly three times, and every `tier` in `'flagship' | 'balanced' | 'economy'` appears exactly three times

##### Example: required model coverage

| providerId | tier | modelId |
| ---------- | ---- | ------- |
| anthropic | flagship | claude-opus-4-5 |
| anthropic | balanced | claude-sonnet-4-6 |
| anthropic | economy | claude-haiku-4-5 |
| openai | flagship | gpt-5 |
| openai | balanced | gpt-5-mini |
| openai | economy | gpt-5-nano |
| google | flagship | gemini-2.5-pro |
| google | balanced | gemini-2.5-flash |
| google | economy | gemini-2.5-flash-lite |

#### Scenario: getPricingForModel returns matching row

- **WHEN** a caller invokes `getPricingForModel("gpt-5-nano")`
- **THEN** the function returns the catalog entry whose `modelId === "gpt-5-nano"` with non-negative numeric `inputUsdPer1M` and `outputUsdPer1M` and a non-empty `vendorPricingUrl`

#### Scenario: getPricingForModel returns undefined for unknown id

- **WHEN** a caller invokes `getPricingForModel("not-a-model")`
- **THEN** the function returns `undefined` and `isKnownModel("not-a-model")` returns `false`

### Requirement: Persist user default-model preferences per provider

The system SHALL persist default-model preferences as one row per `(user_id, provider)` pair in the `user_ai_preferences` table whose composite primary key is `(user_id, provider)`. Each row stores `(user_id, provider, model, updated_at)`. `user_id` MUST be a `text` foreign key to `users.id` with `ON DELETE CASCADE`. Each user MAY hold up to one preference per supported provider (so up to three rows per user); the rows are independent. Preferences SHALL survive process restarts and browser session restarts and SHALL be readable via `GET /api/account/byok`.

#### Scenario: First write inserts the preference row for that provider

- **WHEN** an authenticated user with no existing preference for a given provider saves a valid `(provider, model)` combination
- **THEN** the system inserts one row into `user_ai_preferences` keyed by `(user_id, provider)` with `model` matching the input and `updated_at = NOW()`; rows for other providers are unaffected

#### Scenario: Subsequent write updates the same provider's row in place

- **WHEN** an authenticated user with an existing preference for a given provider saves a different `model` for that same provider
- **THEN** the system updates the existing row using upsert semantics on `(user_id, provider)`, the `model` column reflects the new value, and `updated_at` is refreshed to `NOW()`; no new row is inserted and other providers' rows are unchanged

#### Scenario: Different providers' preferences coexist independently

- **WHEN** an authenticated user already has a preference for `'anthropic'` and PATCHes a preference for `'openai'`
- **THEN** the system inserts one new row for `(user_id, 'openai')`, the existing `(user_id, 'anthropic')` row is unchanged, and both rows coexist

#### Scenario: User deletion cascades

- **WHEN** a user row is deleted from the `users` table
- **THEN** every matching row in `user_ai_preferences` (one per provider) is removed automatically by the foreign-key cascade

### Requirement: PATCH preferences endpoint validates against pricing catalog

The system SHALL expose `PATCH /api/account/byok/preferences` that accepts a JSON body `{ provider: ProviderId, model: string }`. The endpoint MUST require an authenticated session and MUST be rate-limited to 60 requests per minute per session. The endpoint MUST reject the request with HTTP 400 and `{ error: { errorKey: "errors.byok.invalidPreference" } }` when the body fails zod validation, when `provider` is not in `'anthropic' | 'openai' | 'google'`, or when `model` is not present in the BYOK pricing catalog (`isKnownModel(model) === false`). On success, the system MUST upsert the row keyed by `(user_id, provider)` in `user_ai_preferences` and respond with HTTP 200 and `{ data: { provider, model, updatedAt } }`.

#### Scenario: Valid combination is persisted

- **WHEN** an authenticated user PATCHes `{ provider: "openai", model: "gpt-5-mini" }`
- **THEN** the system upserts the row keyed by `(user_id, "openai")`, responds with HTTP 200, and returns `{ data: { provider: "openai", model: "gpt-5-mini", updatedAt: <iso> } }`

#### Scenario: PATCH only updates the addressed provider's row

- **WHEN** an authenticated user with a stored preference of `(anthropic, claude-haiku-4-5)` PATCHes `{ provider: "google", model: "gemini-2.5-flash" }`
- **THEN** the system inserts a new row for `(user_id, "google")` and the existing `(user_id, "anthropic")` row is untouched

#### Scenario: Unknown model id rejected

- **WHEN** an authenticated user PATCHes `{ provider: "openai", model: "gpt-9000" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "errors.byok.invalidPreference" } }`, and no row is written

#### Scenario: Unknown provider id rejected

- **WHEN** an authenticated user PATCHes `{ provider: "cohere", model: "command" }`
- **THEN** the system responds with HTTP 400 and `{ error: { errorKey: "errors.byok.invalidPreference" } }`, and no row is written

#### Scenario: Preference allowed even when corresponding key is not yet saved

- **WHEN** an authenticated user with no saved OpenAI key PATCHes `{ provider: "openai", model: "gpt-5" }`
- **THEN** the system responds with HTTP 200, persists the preference, and does NOT require a saved key as a precondition

#### Scenario: Unauthenticated request rejected

- **WHEN** a client without a valid session sends `PATCH /api/account/byok/preferences`
- **THEN** the system responds with HTTP 401 and `{ error: { errorKey: "errors.byok.notAuthenticated" } }` and no row is written

#### Scenario: Rate limit enforced per session

- **WHEN** an authenticated session sends a 61st `PATCH /api/account/byok/preferences` within one minute
- **THEN** the system responds with HTTP 429, includes a `Retry-After` header, and no row is written

### Requirement: Provider validation base URLs configurable via environment

The system SHALL read each provider's validation base URL from environment variables `ANTHROPIC_API_BASE_URL`, `OPENAI_API_BASE_URL`, and `GOOGLE_API_BASE_URL`. When a variable is unset, the system MUST fall back to the public default for that vendor (`https://api.anthropic.com`, `https://api.openai.com`, `https://generativelanguage.googleapis.com`). The system MUST resolve these URLs at adapter construction time so integration tests can override them with stub server URLs.

#### Scenario: Defaults apply when env unset

- **WHEN** none of the three base URL environment variables are set
- **THEN** each adapter targets its public default vendor URL

#### Scenario: Override applies when env set

- **WHEN** any of the three base URL environment variables is set to a non-empty string
- **THEN** the corresponding adapter sends its validation request to that URL prefix instead of the vendor default

##### Example: env override matrix

| Env var | Set to | Adapter URL prefix |
| ------- | ------ | ------------------ |
| `ANTHROPIC_API_BASE_URL` | `http://localhost:9001` | `http://localhost:9001` |
| `OPENAI_API_BASE_URL` | `http://localhost:9002` | `http://localhost:9002` |
| `GOOGLE_API_BASE_URL` | `http://localhost:9003` | `http://localhost:9003` |
| (any) | unset | vendor default |
