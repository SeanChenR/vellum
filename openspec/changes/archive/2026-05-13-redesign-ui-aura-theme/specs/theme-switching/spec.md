## ADDED Requirements

### Requirement: System-aware theme mode with persisted user preference

The system SHALL expose three theme modes: `system`, `light`, `dark`. The default on first visit SHALL be `system`. The user's explicit choice (light or dark) SHALL be persisted in `localStorage` under the key `vellum.theme`. The system mode SHALL resolve to `light` or `dark` by reading `window.matchMedia('(prefers-color-scheme: dark)')` at runtime, and SHALL update reactively when the operating-system preference changes (only while the mode is `system`).

#### Scenario: First-visit default is system mode

- **GIVEN** a fresh browser with no `vellum.theme` localStorage entry
- **WHEN** the user opens any Vellum page
- **THEN** the effective theme MUST match `prefers-color-scheme`
- **AND** the `localStorage.getItem('vellum.theme')` value MUST be absent (no write before user action)

#### Scenario: User picks light explicitly

- **WHEN** the user toggles theme through the navbar control until light is active
- **THEN** `localStorage.getItem('vellum.theme')` MUST equal `light`
- **AND** subsequent loads MUST stay light even when OS preference is dark

#### Scenario: System mode reacts to OS preference change

- **GIVEN** the user has chosen `system` mode
- **AND** the OS preference is currently light
- **WHEN** the OS preference changes to dark while the page is open
- **THEN** the document MUST switch to dark theme without a page reload

#### Scenario: Explicit mode ignores OS preference change

- **GIVEN** the user has chosen `light` mode explicitly
- **WHEN** the OS preference changes to dark while the page is open
- **THEN** the document MUST stay in light theme

### Requirement: Document theme is applied before React mount

The system SHALL set the `data-theme` attribute on `document.documentElement` before React renders its first frame so the initial paint matches the resolved theme. The initial application SHALL run as the first synchronous statement of `apps/web/src/main.tsx` (or imported as its first import), reading from localStorage and `matchMedia` synchronously.

#### Scenario: No theme flicker on cold load

- **GIVEN** a user whose `vellum.theme` is `dark`
- **WHEN** the user reloads the page on a fast network
- **THEN** the page MUST NOT display the light background at any point during initial paint

### Requirement: Theme tokens are CSS custom properties switched by data-theme

All color, surface, border, and text tokens SHALL be declared as CSS custom properties scoped to `:root[data-theme="light"]` and `:root[data-theme="dark"]`. Components SHALL consume tokens through Tailwind utility classes that resolve via `@theme inline` to those custom properties. Components SHALL NOT hard-code hex values, and SHALL NOT use Tailwind's `dark:` variant for theme switching.

#### Scenario: A primitive renders both themes from the same JSX

- **GIVEN** the `<Card variant="elevated">` primitive
- **WHEN** the same component is rendered under `data-theme="light"` and `data-theme="dark"`
- **THEN** the background color MUST be the value of `--surface-elevated` for the active theme
- **AND** the React tree MUST be byte-identical (no conditional className branching on theme)

### Requirement: Theme toggle is reachable from the navbar

The system SHALL present a single icon button in the navbar's right region that cycles theme mode in the order `system → light → dark → system`. The icon SHALL reflect the active mode (`Monitor` for system, `Sun` for light, `Moon` for dark). The button SHALL be available on every public and authenticated page that renders the navbar.

#### Scenario: Cycling through modes

- **GIVEN** the theme toggle showing the `Sun` icon (light mode)
- **WHEN** the user clicks the toggle once
- **THEN** the icon MUST change to `Moon`
- **AND** the document `data-theme` MUST equal `dark`

#### Scenario: Toggle has accessible label

- **THEN** the toggle MUST have a translated `aria-label` whose value reflects the current mode (e.g. "Switch theme — current: dark")
- **AND** the `aria-label` MUST update when the mode cycles
