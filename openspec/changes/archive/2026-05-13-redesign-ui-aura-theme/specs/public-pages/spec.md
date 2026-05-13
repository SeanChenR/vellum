## ADDED Requirements

### Requirement: All non-canvas pages share the same outer container width

Every page rendered under `PublicLayout` or `AppLayout` SHALL place its content inside a container with `max-width: var(--container-max)` (1152 px / `max-w-6xl`) and horizontal padding of `var(--container-px-md)` (32 px) on screens at or above the `md` breakpoint and `var(--container-px-sm)` (24 px) below. Long-form prose (e.g., `/about` body copy) MAY apply a narrower inner `max-width` for readability, but the outer container width SHALL remain consistent across routes.

#### Scenario: HomePage, AboutPage, DashboardPage share container width

- **GIVEN** the same browser viewport at 1280 px wide
- **WHEN** the user navigates between `/`, `/about`, and `/dashboard`
- **THEN** the outer container measured from page edge to first content gutter MUST be identical on all three routes (±0 px)

#### Scenario: AboutPage body prose remains narrow within wide container

- **GIVEN** the `/about` route is rendered in a 1280 px viewport
- **THEN** the outer container MUST be 1152 px wide
- **AND** the body paragraph MUST clamp its own width to approximately 640 px for reading comfort
- **AND** that prose block MUST sit centered inside the outer container

### Requirement: HomePage feature cards use the elevated Card primitive

The three feature cards on the homepage SHALL use the shared `<Card variant="elevated">` primitive. They SHALL display a hover ring in `--accent-purple` when the pointer enters, with a transition no longer than 200 ms. The card layout SHALL remain a three-column grid at `md` and above, collapsing to a single column below `md`.

#### Scenario: Feature card hover ring

- **GIVEN** the homepage rendered at 1280 px viewport
- **WHEN** the pointer hovers a feature card
- **THEN** the card MUST display a 2 px ring in the active theme's `--accent-purple`
- **AND** the ring MUST disappear when the pointer leaves

### Requirement: Public pages consume the Aura token palette via CSS variables

All public-page surfaces (HomePage, AboutPage, NavBar, Footer) SHALL consume background, text, border, and accent colors through the CSS custom properties declared in `apps/web/src/styles.css` (`--bg`, `--surface`, `--surface-elevated`, `--border`, `--text-primary`, `--text-muted`, `--accent-purple`, `--accent-cyan`, `--accent-pink`, `--accent-orange`, `--accent-red`). They SHALL NOT reference the legacy brand tokens (`--color-ink-navy`, `--color-warm-sepia`, `--color-parchment-cream`, `--color-off-white`) directly; transitional aliases MAY exist in `styles.css` only during the implementation window and MUST be removed before the change is archived.

#### Scenario: Grep finds no legacy token usage in public-page components after archive

- **GIVEN** the change is ready to archive
- **WHEN** `apps/web/src/landing/**/*.tsx` is grepped for `ink-navy|warm-sepia|parchment-cream|off-white`
- **THEN** zero matches MUST be returned

### Requirement: DashboardPage uses a two-column layout with greeting strip, sidebar, and canvas grid

The `/dashboard` route SHALL render three regions inside the unified `max-w-6xl` container:

1. **Greeting strip** at the top: localised date label, "歡迎/Welcome" headline with the user's display name, a search input (placeholder `搜尋畫布⋯` / `Search canvases…`, lucide `Search` icon prefix), and a primary "新畫布 / New canvas" CTA with a lucide `Plus` icon.
2. **Left sidebar** (220 px fixed width at `md` and above; collapses above the grid below `md`): folder list (sentinel rows `全部畫布` / `共享` / `封存` plus user-created folders), optional tag chips, and a sort-order toggle exposing `最近編輯 / Recent` and `字母排序 / Alphabetical` ghost buttons.
3. **Right canvas grid** rendering `<Card variant="hover-ring">` thumbnails in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Each card MUST show a 16:10 thumbnail area, a role badge (`owner` purple / `editor` cyan / `viewer` muted), the canvas title, and a relative last-edited timestamp rendered in `font-mono`.

The page SHALL NOT render any subscription / "Upgrade" CTA. Vellum does not offer a paid plan; that section of the design is intentionally left blank or replaced with a Phase milestone badge.

#### Scenario: Greeting strip exposes search, primary CTA, and welcome line

- **GIVEN** the `/dashboard` route is rendered for an authenticated user named "沛緹"
- **THEN** the greeting region MUST contain (a) today's localised date, (b) a welcome line including the user's display name, (c) a search `<input>` with the lucide `Search` icon, (d) a primary button labelled `新畫布 / New canvas`

#### Scenario: Sidebar folder active state uses accent-purple-soft

- **GIVEN** the user selects a folder named `工作中`
- **THEN** that folder row MUST render with `--accent-purple-soft` (or equivalent `bg-accent-purple/10`) background and `--accent-purple` text
- **AND** other folder rows MUST render with the muted text-primary styling

#### Scenario: Sort order persists across page reload

- **WHEN** the user clicks the `字母排序 / Alphabetical` sort button
- **THEN** the canvas grid MUST re-order alphabetically by title (case-insensitive)
- **AND** `localStorage.getItem("vellum.dashboard.sortOrder")` MUST equal `"alphabetical"`
- **AND** reloading the page MUST keep the alphabetical order without an additional click

#### Scenario: Search filters the canvas grid in place

- **GIVEN** the user has 8 canvases including one titled "電商訂單處理流程"
- **WHEN** the user types `電商` into the search input
- **THEN** the canvas grid MUST render only canvases whose title contains `電商` (case-insensitive)
- **AND** clearing the input MUST restore the full grid without a network refetch

#### Scenario: No subscription/upgrade callout is rendered

- **GIVEN** the `/dashboard` route is rendered
- **THEN** the DOM MUST NOT contain text matching `升級 / Upgrade / Studio / Pro`
- **AND** the sidebar MUST NOT contain a paid-plan promotional card

## MODIFIED Requirements

### Requirement: Navbar exposes product identity and primary navigation

The NavBar SHALL render as a CSS grid with three regions arranged as `[1fr][auto][1fr]`. The left region SHALL hold the brand mark (logo + wordmark in Newsreader). The center region SHALL hold the primary navigation links (`Home`, `About`) centered horizontally. The right region SHALL hold, in this order: `<LocaleToggle />`, `<ThemeToggle />`, and the auth action (avatar menu when signed in, "Sign in" CTA when signed out, fixed-width placeholder while auth is loading). All right-region controls SHALL be 36 px tall and visually align on the same baseline. The auth-state placeholder SHALL have the same rendered width as the signed-in avatar menu so layout does not shift when auth resolves.

#### Scenario: NavBar regions render in the correct order

- **GIVEN** an authenticated user visits the homepage
- **THEN** the NavBar children in DOM order MUST be: brand, primary nav, locale toggle, theme toggle, avatar menu
- **AND** primary nav MUST be centered within its grid cell

#### Scenario: Loading state does not shift layout

- **GIVEN** the auth status is still loading
- **THEN** the auth action SHALL render a placeholder with the same width as the signed-in avatar menu
- **AND** the navbar layout MUST NOT shift when auth resolves

#### Scenario: Active route link is visually distinguished

- **GIVEN** the user is currently on `/about`
- **THEN** the "About" link MUST display the active-route style (filled text color plus a 2 px accent-purple underline)
- **AND** all other links MUST display the muted style

### Requirement: Footer surfaces version and a single attribution row

The Footer SHALL render inside a container with the same `max-width` as the NavBar (1152 px / `max-w-6xl`) and matching horizontal padding. The footer SHALL display the build version sourced from `VELLUM_VERSION` together with the brand attribution on a single row at `md` and above; below `md` the row wraps as needed. Footer text and links SHALL consume `--text-muted` for body color and `--accent-purple` on hover. Footer SHALL NOT hard-code colors.

#### Scenario: Footer dark theme

- **GIVEN** `data-theme="dark"` is active
- **THEN** Footer text MUST resolve to the dark-theme `--text-muted` token value
- **AND** Footer hover MUST resolve to the dark-theme `--accent-purple` token value

#### Scenario: Footer container matches Navbar width

- **GIVEN** the same browser viewport at 1280 px
- **THEN** the Footer container measured from page edge MUST equal the NavBar container width (±0 px)
