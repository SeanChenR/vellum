## ADDED Requirements

### Requirement: ProfilePage renders the form inside an elevated card

The `/account/profile` route SHALL render the profile form inside a `<Card variant="elevated">` placed within the standard `max-w-6xl` page container. The form SHALL expose three controls: display name input, avatar URL input, and a destructive trigger that opens the delete-account dialog. The form's primary submit button SHALL use the `<Button variant="primary">` styling.

#### Scenario: Form lives inside an elevated card with consistent page container

- **GIVEN** the `/account/profile` route is rendered in a 1280 px viewport
- **THEN** the outer page container MUST be 1152 px wide (matching the navbar)
- **AND** the form MUST sit inside an element with the `<Card variant="elevated">` styling

### Requirement: SessionsPage renders each session as a card row with current-session badge

The `/account/sessions` route SHALL render every active session as its own row inside a parent `<Card>` container. The currently active session SHALL display a cyan badge with the i18n key `account.sessions.thisDeviceBadge` and SHALL be pinned to the top of the list. Each row SHALL display device label, IP, last-seen timestamp, and a destructive `Revoke` action that opens a confirmation dialog before performing the destructive call.

#### Scenario: Current session is pinned with cyan badge

- **GIVEN** the user has three active sessions including the one on the current device
- **WHEN** `/account/sessions` is rendered
- **THEN** the current session MUST appear as the first row
- **AND** the first row MUST display a `<Badge tone="cyan">` whose text is the translation of `account.sessions.thisDeviceBadge`
- **AND** the first row MUST NOT show a Revoke action

#### Scenario: Revoke requires confirmation

- **WHEN** the user clicks `Revoke` on any non-current session row
- **THEN** a confirmation dialog MUST open before the DELETE request is sent
- **AND** the DELETE request MUST only fire after the user confirms

### Requirement: ApiKeysPage groups BYOK providers and MCP tokens into two card sections

The `/account/api-keys` route SHALL render two distinct sections within a single `max-w-6xl` page container:

- Section A — Provider Keys: three rows (Anthropic, OpenAI, Google), each row using `<Card>` and containing the provider label, masked key preview, replace and delete actions, and the per-provider default model picker.
- Section B — MCP Tokens: the existing `<PatTokensSection />` rendered as a sibling `<Card>` containing the token list and the "Create token" button.

Section B SHALL sit visually below Section A separated by a 32 px gap. Both sections SHALL share the same container width and consume the same `<Card>` primitive styles.

#### Scenario: Both sections are visible on the route

- **WHEN** the `/account/api-keys` route renders for an authenticated user
- **THEN** the page MUST contain exactly one section labelled `account.apiKeys.title`
- **AND** the page MUST contain exactly one section labelled `account.pat.title`
- **AND** the second section MUST appear after the first in DOM order

#### Scenario: Create-token plaintext dialog uses cyan highlight + i18n warning

- **WHEN** the user creates a new MCP token
- **THEN** the resulting dialog MUST show the plaintext token in a region styled with `--accent-cyan-soft` background
- **AND** the warning copy MUST come from the i18n key `account.pat.plaintextWarning`
- **AND** closing the dialog MUST remove the plaintext from the DOM

### Requirement: Account settings live under a single tabbed route

The system SHALL expose account management as a single `/account` route containing a tab navigation over four panels: `profile` (個人資料), `sessions` (登入裝置), `api-keys` (API 與 MCP), and `pricing` (定價參考). The active tab SHALL be controlled by the `?tab=<id>` search parameter; the default is `profile`.

The three pre-existing routes `/account/profile`, `/account/sessions`, `/account/api-keys` SHALL be retained for backward compatibility but their component SHALL redirect (client-side) to the equivalent `/account?tab=<id>` URL.

The tab navigation SHALL satisfy WAI-ARIA tabs pattern: parent `role="tablist"`, each tab `role="tab"` with `aria-selected` and `aria-controls`, each panel `role="tabpanel"` with matching `id`. Active-tab visual state SHALL use `--accent-purple` underline.

#### Scenario: Default tab is profile

- **GIVEN** a signed-in user navigates to `/account`
- **THEN** the URL MUST become `/account?tab=profile` (or stay `/account` with profile rendered)
- **AND** the profile panel MUST be visible
- **AND** the other three panels MUST be hidden (display: none or unmounted)

#### Scenario: Legacy /account/profile redirects to tab

- **WHEN** a user navigates to `/account/profile`
- **THEN** the URL MUST be replaced with `/account?tab=profile`
- **AND** the profile panel MUST be rendered

#### Scenario: Clicking a tab updates the URL and active panel

- **GIVEN** the user is on `/account?tab=profile`
- **WHEN** the user clicks the `API 與 MCP` tab
- **THEN** the URL MUST become `/account?tab=api-keys`
- **AND** the API & MCP panel MUST be visible
- **AND** the active tab's `aria-selected` MUST equal `"true"` while the others equal `"false"`

### Requirement: Pricing tab renders BYOK pricing as provider-grouped tier cards

The Pricing tab SHALL render three `<Card variant="elevated">` cards, one per brand (Claude / OpenAI / Gemini — the consumer-facing brand for each provider's model lineup). Each card SHALL contain a `<table>` body with three rows ordered `flagship` → `balanced` → `economy`. Each row SHALL display: a tier label badge (`flagship` purple / `balanced` cyan / `economy` muted), the model identifier in `font-mono`, the input price, and the output price. The pricing data SHALL be sourced from the existing `BYOK_PRICING` constant in `@vellum/shared/byok-pricing`. The shared unit ("USD / 1M tokens") SHALL appear once in the section subtitle and SHALL NOT be repeated inside each card.

Each card SHALL render the brand PNG asset (`claude.png` / `openai.png` / `gemini.png`) as its header icon directly (no surrounding white-background wrapper, since the PNG assets are transparent). The card SHALL carry a 3 px top border in the brand color. The legacy `ApiKeysPricingTable` component MAY remain in the codebase but SHALL NOT be imported by the Pricing tab.

#### Scenario: Three provider cards rendered

- **WHEN** the Pricing tab is active
- **THEN** the panel MUST contain exactly three `<Card variant="elevated">` elements
- **AND** their headings MUST match the three provider names (Anthropic, OpenAI, Google) in that order

#### Scenario: Tier badge tones map to spec

- **GIVEN** the Pricing tab renders the Anthropic card
- **THEN** the `flagship` row MUST contain a `<Badge tone="purple">`
- **AND** the `balanced` row MUST contain a `<Badge tone="cyan">`
- **AND** the `economy` row MUST contain a `<Badge tone="muted">`

### Requirement: API & MCP tab uses row-based layout with saved-state indicator

The API & MCP tab SHALL render the three BYOK provider rows inside a single `<Card>` (NOT three separate cards). Adjacent provider rows SHALL be separated by a horizontal divider (`divide-y` on the wrapper), but each provider row SHALL NOT contain any internal horizontal dividers — the Identity / Credential / Default Model zones inside a row are separated by vertical spacing only. Each row SHALL show: the provider's brand PNG (anthropic / openai / google asset, rendered directly without a surrounding solid-background wrapper since the PNGs are transparent), provider name, masked key in `font-mono`, and replace + delete actions inline (right-aligned). When a provider key is saved, the row SHALL display a `<Badge tone="cyan" dot>` with text `已連線 / Connected`.

The PAT (MCP Tokens) list SHALL render each token as a single horizontal row: lucide `Key` icon, token name (semibold), masked prefix in `font-mono`, relative last-used time, expiration date, and a destructive ghost `Revoke` button — all on one line with appropriate gap.

The Create-token dialog plaintext reveal SHALL show the plaintext inside a region styled with `bg-accent-cyan/10` and a copy button containing a lucide `Copy` icon.

#### Scenario: Saved provider row shows cyan dot badge

- **GIVEN** the user has saved an Anthropic API key
- **WHEN** the API & MCP tab is rendered
- **THEN** the Anthropic row MUST contain a `<Badge tone="cyan" dot>` whose text matches the i18n key `account.apiKeys.savedBadge`

#### Scenario: Unsaved provider row does not show the saved badge

- **GIVEN** the user has NOT saved a Google API key
- **WHEN** the API & MCP tab is rendered
- **THEN** the Google row MUST NOT contain a `<Badge tone="cyan" dot>`

## MODIFIED Requirements

### Requirement: Update profile

The system SHALL expose `PATCH /api/account/profile` accepting a JSON body containing zero or more of: `name` (string ≤ 64 chars after trim), `image` (https URL or empty string), `locale` (`zh-TW` | `en`). The endpoint SHALL update only the supplied fields, persist the change, and respond with the full updated user profile.

The ProfilePage form (`apps/web/src/account/ProfilePage.tsx`) SHALL submit only `name` and `image` in its payload; it SHALL NOT include `locale`. Locale changes from the UI SHALL be performed exclusively through the navbar `<LocaleToggle />`, which calls the same `PATCH /api/account/profile` endpoint with a `{ locale }` body. The ProfilePage form schema SHALL NOT include a `locale` field, and the form SHALL NOT render a locale select element.

#### Scenario: ProfilePage submit excludes locale

- **GIVEN** the `/account/profile` route is rendered
- **WHEN** the user edits the display name and clicks Save
- **THEN** the resulting `PATCH /api/account/profile` request body MUST contain only `{ name, image }` (no `locale` key)

#### Scenario: ProfilePage has no locale select element

- **GIVEN** the `/account/profile` route is rendered
- **THEN** the form MUST NOT render any `<select>` or `<input>` labelled with `account.profile.localeLabel`

#### Scenario: Endpoint accepts locale from navbar toggle

- **GIVEN** the user is signed in and toggles the navbar locale to `en`
- **WHEN** the client sends `PATCH /api/account/profile` with body `{ "locale": "en" }`
- **THEN** the response MUST reflect `locale: "en"` and persist the change to the database
