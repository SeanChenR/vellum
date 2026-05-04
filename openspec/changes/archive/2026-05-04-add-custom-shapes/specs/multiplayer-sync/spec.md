## ADDED Requirements

### Requirement: Custom shapes enforce a first-editor-wins edit lock during multiplayer sessions

When two or more users have the same canvas open and one user begins editing a custom shape (Markdown / Code / Callout / Link card as defined by the `canvas-shapes` capability), other users SHALL be prevented from entering the same shape's editor until the first user exits or the lock times out. The lock MUST be derived from tldraw's existing `editingShapeId` field combined with the local presence record, NOT from a separate server-side lock table.

A custom hook `useShapeEditLock(shapeId)` in `apps/web/src/canvas/shapes/use-shape-edit-lock.ts` SHALL return `{ canEdit: boolean; lockedBy: { userId: string; userName: string } | null }`. It MUST resolve as follows:

- If `editingShapeId` from any other user's presence equals `shapeId`, return `canEdit: false` with `lockedBy` populated from that user's presence
- If `editingShapeId` is null OR equals `shapeId` for the local user, return `canEdit: true, lockedBy: null`

The hook MUST update reactively when remote presence changes.

When `canEdit` is false, the shape's view MUST display a localized lock badge using the key `shapes.common.lockedBy` interpolated with the locking user's name. The shape's editor entry points (double-click for markdown / callout, focus for code textarea, URL edit for link card) MUST be disabled while locked.

The lock MUST automatically clear when the locking user disconnects (tldraw presence heartbeat removes their record) or when their presence's `lastActiveAt` exceeds 5 minutes (stale-lock fallback for tabs that didn't disconnect cleanly).

#### Scenario: Second user sees lock badge while first user edits

- **WHEN** user A double-clicks a markdown shape and the editor dialog opens, then user B looks at the same canvas
- **THEN** user B's view of that markdown shape MUST display a lock badge with user A's name and MUST NOT allow user B to open the editor by double-click

#### Scenario: Lock releases when first user closes editor

- **WHEN** user A's editor dialog closes (Save or Escape) and `editingShapeId` clears
- **THEN** within one tldraw sync tick, user B's view MUST remove the lock badge and double-click MUST open the editor

#### Scenario: Stale lock clears after 5 minutes of inactivity

- **WHEN** user A enters edit mode on a shape and their tab becomes unresponsive for 6 minutes without a clean disconnect
- **THEN** user B's view of the shape MUST clear the lock badge after the 5-minute threshold and double-click MUST become available

#### Scenario: Locking user's own view is unaffected

- **WHEN** user A is editing a shape and `editingShapeId` equals that shape for user A's local presence
- **THEN** user A's view MUST NOT display the lock badge and the editor MUST function normally
