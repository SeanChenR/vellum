## ADDED Requirements

### Requirement: System provides a reusable focus-trap React hook

The system SHALL provide a React hook at `apps/web/src/a11y/use-focus-trap.ts` named `useFocusTrap` that traps keyboard focus inside a containing element while the trap is active. The hook MUST accept an `active` boolean and a `ref` to a container element. While `active` is true, the hook MUST: (1) move focus to the first focusable descendant of the container on activation; (2) intercept Tab key presses to cycle focus among focusable descendants (Tab from last → first; Shift+Tab from first → last); (3) save the previously-focused element on activation and restore focus to it when the trap deactivates. Focusable descendants are detected via the standard selector covering anchors with href, non-disabled buttons / inputs / textareas / selects, and elements with tabindex other than -1.

#### Scenario: Activating the trap moves focus into the container

- **WHEN** a component renders `useFocusTrap({ active: true, ref })` against a container holding a button followed by an input
- **THEN** the first focusable descendant (the button) MUST receive focus

#### Scenario: Tab from the last element wraps to the first

- **WHEN** focus is on the last focusable element in the trapped container
- **AND** the user presses the Tab key
- **THEN** the system MUST prevent the default Tab behaviour
- **AND** focus MUST move to the first focusable element in the container

#### Scenario: Shift+Tab from the first element wraps to the last

- **WHEN** focus is on the first focusable element in the trapped container
- **AND** the user presses Shift+Tab
- **THEN** the system MUST prevent the default Shift+Tab behaviour
- **AND** focus MUST move to the last focusable element in the container

#### Scenario: Deactivating the trap restores focus to the previous element

- **WHEN** the trap deactivates (the `active` prop transitions to false, or the component unmounts)
- **THEN** the system MUST attempt to restore focus to whichever element held focus before the trap activated
- **AND** the system MUST NOT throw if that element is no longer in the document

##### Example: Tab cycle in a 3-button modal

| Step | Focus before | Key      | Focus after |
| ---- | ------------ | -------- | ----------- |
| 1    | (outside)    | activate | Button A (first focusable) |
| 2    | Button A     | Tab      | Button B    |
| 3    | Button B     | Tab      | Button C (last focusable)  |
| 4    | Button C     | Tab      | Button A (cycle wraps) |
| 5    | Button A     | Shift+Tab | Button C (cycle wraps backward) |
| 6    | Button B     | deactivate | (restored to outside trigger) |

---

### Requirement: All four existing dialogs trap keyboard focus while open

The system SHALL apply the focus-trap behaviour defined above to each of the four dialog components: `ShareDialog` (`apps/web/src/canvas/ShareDialog.tsx`), `CanvasRenameDialog` (`apps/web/src/components/CanvasRenameDialog.tsx`), `FolderDeleteDialog` (`apps/web/src/components/FolderDeleteDialog.tsx`), and the inline `DeleteConfirmDialog` defined inside `MainMenu` (`apps/web/src/chrome/MainMenu.tsx`). The trap MUST activate when each dialog opens and deactivate when it closes. Existing Escape-to-close behaviour MUST continue to work alongside the trap.

#### Scenario: Tab inside an open dialog never escapes the dialog

- **WHEN** any of the four dialogs is open and the user presses Tab repeatedly
- **THEN** focus MUST cycle only among focusable elements inside the dialog overlay
- **AND** focus MUST NOT move to elements behind the dialog

#### Scenario: Escape still closes the dialog

- **WHEN** any of the four dialogs is open and the user presses Escape
- **THEN** the dialog MUST close
- **AND** focus MUST return to the element that opened the dialog

---

### Requirement: All interactive elements share a consistent focus-visible ring

The system SHALL provide a single utility class `focus-visible-ring` defined in `apps/web/src/styles.css` that produces a warm-sepia outline ring with a 2px offset against the off-white page background, applied only on `:focus-visible` (keyboard focus, not mouse focus). Every interactive element rendered by the application chrome — including but not limited to the Navbar logo and links, Footer links, Tab strip buttons, dialog confirm/cancel buttons, dropdown menu items, the user avatar trigger, and form inputs — MUST apply this utility either directly or via a wrapping component that applies it.

#### Scenario: Keyboard Tab through the public Homepage shows visible focus rings

- **WHEN** a keyboard user lands on `/` and presses Tab repeatedly
- **THEN** every interactive element that receives focus MUST display the warm-sepia ring with the 2px offset against off-white

#### Scenario: Mouse click on a button does NOT trigger the focus-visible ring

- **WHEN** a mouse user clicks any interactive element
- **THEN** the warm-sepia ring MUST NOT appear (since `:focus-visible` is not active for mouse focus)

---

### Requirement: PublicLayout provides a skip-to-main-content link

The system SHALL render a "skip to main content" anchor as the first interactive element inside `PublicLayout` (used by `/`, `/about`, `/login`). The anchor MUST be visually hidden by default (using a screen-reader-only style) and MUST become visible when it receives keyboard focus. Activating the anchor (Enter or click) MUST move focus to the page's `<main>` element. The anchor's accessible label MUST come from the i18n key `a11y.skipToMain`. The same skip-link MUST also be rendered inside `AppLayout` (used by `/dashboard`, `/account/profile`, `/account/sessions`).

#### Scenario: Keyboard user sees the skip-link on first Tab

- **WHEN** a keyboard user lands on `/` and presses Tab once
- **THEN** the skip-link MUST become visible at the top-left of the viewport
- **AND** activating it MUST move focus to the `<main>` element

#### Scenario: Skip-link is hidden visually until focused

- **WHEN** the skip-link is rendered but does not have keyboard focus
- **THEN** the link MUST NOT be visible to a sighted user (it MUST be present in the accessibility tree for screen readers)

#### Scenario: AppLayout also exposes the skip-link

- **WHEN** an authenticated user lands on `/dashboard` and presses Tab once
- **THEN** the same skip-link behaviour MUST apply

---

### Requirement: Icon-only buttons must declare an accessible label

The system SHALL ensure that every `<button>` element whose only visible content is an SVG icon or an image (i.e., the button has no rendered text node) declares an `aria-label` (or `aria-labelledby`) attribute whose value comes from the i18n namespace. The system SHALL provide a static lint-style test (`apps/web/src/a11y/icon-button-audit.test.ts`) that scans every TSX source file under `apps/web/src/` (excluding test files) and fails when it finds an icon-only button without an accessible label.

#### Scenario: Audit fails on icon-only button without aria-label

- **WHEN** a TSX file contains `<button onClick={...}><PencilIcon /></button>` with no `aria-label` / `aria-labelledby`
- **THEN** the icon-button-audit test MUST fail
- **AND** the failure message MUST include the file path and line number

#### Scenario: Audit passes for icon button with localized aria-label

- **WHEN** every icon-only button has `aria-label={t("...")}` referencing a defined i18n key
- **THEN** the icon-button-audit test MUST pass
