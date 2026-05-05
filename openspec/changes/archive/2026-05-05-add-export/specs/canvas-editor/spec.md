## MODIFIED Requirements

### Requirement: MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu

The MainMenu component SHALL expose four top-level items: Rename, Duplicate, Delete, and Export. Rename, Duplicate, and Delete SHALL invoke mutations supplied by the canvas data layer. Export SHALL be a submenu containing four items — PNG, SVG, PDF, and JSON — each wired to the export pipeline defined by the canvas-export capability. The PNG and PDF items SHALL each open a nested submenu offering 1×, 2×, and 4× scale factors; the SVG and JSON items SHALL trigger their export action directly. The Export submenu trigger SHALL be rendered only when the editor session is not read-only; for read-only sessions, the entire Export submenu (including its trigger) SHALL NOT be rendered.

#### Scenario: User opens the main menu

- **WHEN** the user activates the main menu trigger
- **THEN** the dropdown MUST render with four items in this order: Rename, Duplicate, Delete, Export — except that Export MUST be omitted when the session is read-only

#### Scenario: User selects Rename

- **WHEN** the user activates the Rename item
- **THEN** the system MUST open the same rename dialog described in the TopBar requirement

#### Scenario: User selects Duplicate

- **WHEN** the user activates the Duplicate item
- **THEN** the system MUST invoke the duplicate mutation supplied by the canvas data layer with the current canvas id

#### Scenario: User selects Delete

- **WHEN** the user activates the Delete item
- **THEN** the system MUST open a confirmation dialog whose confirm button invokes the delete mutation
- **AND** dismissing the confirmation MUST NOT invoke the delete mutation

#### Scenario: Editor user opens the Export submenu

- **WHEN** an editor or owner hovers or activates the Export item
- **THEN** the submenu MUST render four items in this order: PNG, SVG, PDF, JSON
- **AND** the PNG and PDF items MUST each surface a nested submenu of 1×, 2×, and 4× scale factors
- **AND** all four items MUST be in an enabled (interactive) state

#### Scenario: Read-only viewer opens the main menu

- **WHEN** a session whose `isReadOnly` flag is true activates the main menu trigger
- **THEN** the dropdown MUST NOT render the Export submenu trigger
- **AND** keyboard tab navigation MUST NOT visit any export-related element
