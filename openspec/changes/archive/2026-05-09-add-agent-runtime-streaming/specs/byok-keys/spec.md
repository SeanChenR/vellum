## MODIFIED Requirements

### Requirement: OpenAI key validation via vendor ping

The OpenAI provider adapter SHALL validate a candidate key by sending a single GET request to `${OPENAI_API_BASE_URL}/v1/models` (default base URL `https://api.openai.com`) with the header `Authorization: Bearer <plaintext>` and a 5-second abort timeout. The adapter MUST translate the response into an `errorKey` according to the table below.

The endpoint shape is GET-with-no-body — not POST `/v1/chat/completions`. The legacy chat-completions ping was incompatible with reasoning-style validation models (e.g., `gpt-5-nano`), which reserve internal thinking-token budget BEFORE emitting any response token; a small `max_tokens` / `max_completion_tokens` cap caused OpenAI to return HTTP 400 (`max_tokens reached`) and the validator to surface `errors.byok.unreachable` to the user. The list-models endpoint is token-free, payload-free, and matches the Google adapter's authentication-only ping pattern.

#### Scenario: Successful validation returns ok

- **WHEN** the OpenAI API responds with HTTP 200 (a JSON list of models)
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

#### Scenario: Validation request is GET with no body

- **WHEN** the adapter issues the validation request
- **THEN** the outgoing HTTP method SHALL be `GET`, the request SHALL have no body, and the URL SHALL be `${OPENAI_API_BASE_URL}/v1/models` exactly. The adapter SHALL NOT send `model`, `messages`, `max_tokens`, or `max_completion_tokens` parameters because the endpoint does not accept them.
