## ADDED Requirements

### Requirement: Authentication pages render centered card layouts using shared primitives

The `/login`, `/auth/verify`, and `/invite-error` routes SHALL each render a single centered `<Card variant="elevated">` containing their respective content. The card SHALL be vertically and horizontally centered within the viewport between the navbar and footer, with a maximum width of 420 px. The card border, surface, and text color SHALL resolve through Aura theme tokens and adapt automatically to the active theme.

#### Scenario: LoginPage centers an elevated card

- **GIVEN** the `/login` route is rendered in a 1280 × 800 viewport
- **THEN** the page MUST contain exactly one `<Card variant="elevated">` element with a maximum rendered width of 420 px
- **AND** the card MUST be centered both horizontally and vertically within the available viewport space (excluding the navbar and footer)

#### Scenario: LoginPage shows email + Google sign-in separated by a divider

- **GIVEN** the `/login` route is rendered
- **THEN** the card MUST contain a magic-link email input field above an "or" divider above a "Sign in with Google" button
- **AND** the magic-link submit button MUST use the `<Button variant="primary">` styling

#### Scenario: MagicLinkVerifyPage shows a Mail icon above its status copy

- **GIVEN** the `/auth/verify` route is rendered
- **THEN** the card MUST display a lucide `Mail` icon at 32 px above the status message
- **AND** the icon MUST resolve its color through `--accent-purple`

#### Scenario: InviteErrorPage uses orange accent for the warning state

- **GIVEN** the `/invite-error` route is rendered
- **THEN** the card MUST display the warning icon and headline colored via `--accent-orange`
- **AND** the body copy MUST resolve through `--text-muted`
