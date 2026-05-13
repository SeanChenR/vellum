## ADDED Requirements

### Requirement: Card hover-ring transition is bounded and respects reduced-motion

The `<Card>` primitive's `hover-ring` variant SHALL apply a 2 px ring in `--accent-purple` on pointer hover. The ring SHALL appear and disappear via a CSS transition no longer than 200 ms (`transition-shadow duration-150`). When `prefers-reduced-motion: reduce` is active, the transition duration SHALL collapse to `0ms` and the ring SHALL toggle instantly on hover.

#### Scenario: Card hover ring transitions within 200 ms by default

- **GIVEN** the user has no reduced-motion preference
- **AND** the homepage feature card is hovered
- **THEN** the ring MUST animate in over a duration ≤ 200 ms
- **AND** removing the pointer MUST reverse the transition within ≤ 200 ms

#### Scenario: Reduced-motion users see instant hover ring

- **GIVEN** the user has `prefers-reduced-motion: reduce`
- **WHEN** the user hovers a `hover-ring` card
- **THEN** the ring MUST appear with no perceptible animation (computed transition-duration `0s`)

### Requirement: Theme switching is instant with no animation

The system SHALL switch between light and dark themes without any CSS transition on background, text, or border properties at the document root. Theme switching is intentionally non-animated because partial-frame transitions look worse than an instant cut.

#### Scenario: Toggling theme does not animate root colors

- **GIVEN** the user clicks the theme toggle in the navbar
- **THEN** the `<html>` element MUST NOT have any `transition` property that includes `background-color`, `color`, or `border-color`
- **AND** the first frame after the toggle MUST already display the target theme's tokens

#### Scenario: Component-level transitions still run on theme switch

- **GIVEN** a button is currently hovered while the user toggles the theme
- **THEN** the document MUST swap themes instantly
- **AND** the button's own hover-state transition MUST continue running normally (button transitions are not suppressed by the root-level no-transition rule)
