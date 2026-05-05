## ADDED Requirements

### Requirement: Motion library dependency is installed and importable

The system SHALL ensure the `motion` npm package is installed in the `apps/web` workspace and is importable from any module under `apps/web/src/`. The lockfile MUST record an exact resolved version. MagicUI and Animate UI components are NOT npm dependencies of this milestone — those component libraries follow a copy-into-source distribution model (shadcn CLI) and are deferred to a later change once the shadcn registry is wired into this repo.

#### Scenario: motion library is importable

- **WHEN** any module under `apps/web/src/` imports a default or named export from `motion`
- **THEN** the bundler MUST resolve the import without error during type checking and during the production build

---

### Requirement: System provides four reusable motion primitives

The system SHALL expose four React component primitives from `apps/web/src/motion/primitives.tsx` for declarative entrance and stagger animations: `<FadeIn>`, `<SlideIn>`, `<ScaleIn>`, and `<StaggerContainer>`. Each primitive MUST forward its `children` prop to the rendered output. Each primitive MUST accept optional configuration props for delay (in milliseconds) and duration (in milliseconds). The `<SlideIn>` primitive MUST accept a `from` prop with the value `"left"`, `"right"`, `"top"`, or `"bottom"`. The `<StaggerContainer>` primitive MUST stagger child entrance animations by a configurable interval (in milliseconds) defaulting to 80ms.

#### Scenario: FadeIn animates child opacity from 0 to 1

- **WHEN** a component renders `<FadeIn>` wrapping any child element
- **THEN** the wrapped element MUST start at `opacity: 0` on mount
- **AND** transition to `opacity: 1` within the configured duration (default 300ms)

#### Scenario: SlideIn translates from the configured direction

- **WHEN** a component renders `<SlideIn from="left">` wrapping a child
- **THEN** the wrapped element MUST start with a non-zero negative `translateX` offset
- **AND** transition to `translateX: 0` within the configured duration

#### Scenario: StaggerContainer cascades child entrances

- **WHEN** a component renders `<StaggerContainer staggerMs={100}>` wrapping three direct child `<FadeIn>` elements
- **THEN** child 1 MUST start its animation at t=0
- **AND** child 2 MUST start its animation at t=100ms
- **AND** child 3 MUST start its animation at t=200ms

##### Example: stagger interval table

| staggerMs | Child 1 start | Child 2 start | Child 3 start |
| --------- | ------------- | ------------- | ------------- |
| 80 (default) | 0ms | 80ms | 160ms |
| 100 | 0ms | 100ms | 200ms |
| 200 | 0ms | 200ms | 400ms |

---

### Requirement: All motion primitives respect prefers-reduced-motion

The system SHALL detect the operating-system preference `prefers-reduced-motion: reduce` on every motion primitive render. When the preference is active, the primitive MUST disable the animation by setting effective duration to 0 and skipping the initial transform offset. The detection mechanism MUST use a runtime hook (motion library's `useReducedMotion` or equivalent) so changes to the OS setting at runtime take effect without page reload.

#### Scenario: Reduced-motion user sees instant render with no transition

- **WHEN** the OS reports `prefers-reduced-motion: reduce` is true at the moment a `<FadeIn>` mounts
- **THEN** the wrapped element MUST appear at `opacity: 1` from the first paint frame
- **AND** the rendered element MUST NOT have any non-zero CSS transition duration applied

#### Scenario: Reduced-motion preference toggling at runtime takes effect

- **WHEN** the OS preference changes from `no-preference` to `reduce` while a page with motion primitives is mounted
- **THEN** subsequent primitive mounts on the same page MUST honor the new preference without a page reload

---

### Requirement: Motion is allowed only on listed surfaces

The system SHALL allow motion primitives and any direct `motion` library imports to be rendered only on the following surfaces: the Homepage hero and feature sections, the About page, dialog enter and exit transitions (ShareDialog, CanvasRenameDialog, FolderDeleteDialog, MainMenu DeleteConfirmDialog), the Dashboard list rendering (canvas and folder cards), toast notifications, sidebar slide transitions, empty states, and loading indicators. The system MUST NOT import any motion primitive or `motion` library symbol into the canvas-editor module (`apps/web/src/canvas/Editor.tsx` and any module imported transitively by `Editor.tsx` for the purpose of rendering inside the tldraw canvas surface) or into any module that renders multiplayer cursor or presence indicators.

#### Scenario: Editor.tsx contains no motion imports

- **WHEN** the static imports of `apps/web/src/canvas/Editor.tsx` are inspected
- **THEN** none of the import paths MUST resolve to `motion` or `apps/web/src/motion/primitives.tsx`

#### Scenario: Multiplayer cursor module contains no motion imports

- **WHEN** the static imports of `apps/web/src/canvas/CollaboratorAvatars.tsx` and any future module rendering multiplayer cursor or presence indicators are inspected
- **THEN** none of the import paths MUST resolve to `motion` or `apps/web/src/motion/primitives.tsx`

##### Example: allowed vs forbidden surface mapping

| Surface | Motion allowed? |
| ------- | --------------- |
| Homepage hero | yes |
| About page section | yes |
| Dashboard canvas list | yes |
| ShareDialog enter / exit | yes |
| Toast | yes |
| Sidebar slide | yes |
| Loading spinner | yes |
| Empty state | yes |
| tldraw canvas inner surface | no |
| Multiplayer cursor / presence | no |
| Tool toolbar inside canvas | no |

---

### Requirement: Existing dialogs receive enter and exit motion

The system SHALL apply enter and exit motion transitions to the following existing dialog components: `ShareDialog` (`apps/web/src/canvas/ShareDialog.tsx`), `CanvasRenameDialog` (`apps/web/src/components/CanvasRenameDialog.tsx`), `FolderDeleteDialog` (`apps/web/src/components/FolderDeleteDialog.tsx`), and the inline `DeleteConfirmDialog` defined inside `MainMenu` (`apps/web/src/chrome/MainMenu.tsx`). The transition MUST combine an opacity fade (0 → 1 on enter, 1 → 0 on exit) with a scale transform (0.95 → 1 on enter, 1 → 0.95 on exit). The transition duration MUST be 180 milliseconds when the user has not requested reduced motion, and 0 milliseconds when the user has requested reduced motion.

#### Scenario: Dialog mounts with fade-and-scale enter

- **WHEN** any of the four listed dialogs transitions from closed to open
- **THEN** the dialog overlay's first frame MUST have `opacity: 0` and a `scale` of approximately 0.95
- **AND** the dialog MUST reach `opacity: 1` and `scale: 1` within 180 milliseconds (or instantly under reduced motion)

#### Scenario: Dialog unmounts with fade-and-scale exit

- **WHEN** any of the four listed dialogs transitions from open to closed
- **THEN** the dialog MUST animate from `opacity: 1, scale: 1` toward `opacity: 0, scale: 0.95` before unmounting
- **AND** the unmount MUST complete within 180 milliseconds (or instantly under reduced motion)

---

### Requirement: Dashboard list applies stagger entrance on mount

The system SHALL animate the entrance of canvas and folder cards on the Dashboard list using `<StaggerContainer>` wrapping `<FadeIn>` per card. The stagger MUST use the default interval (80 milliseconds). The stagger MUST run only on initial list mount, not on subsequent updates within the same session (e.g., when a new canvas is created, the new card MAY animate in but existing cards MUST NOT re-animate).

#### Scenario: First render of dashboard list staggers cards

- **WHEN** an authenticated visitor first navigates to `/dashboard` and the canvas list contains three or more cards
- **THEN** the first card MUST start animating at t=0
- **AND** each subsequent card MUST start animating 80 milliseconds after the previous card

#### Scenario: Re-rendering the dashboard list does not re-stagger existing cards

- **WHEN** a new canvas is created and the list re-renders to include the new card
- **THEN** the existing cards MUST NOT re-trigger their entrance animation
- **AND** the new card MAY animate in independently
