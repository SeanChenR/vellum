## REMOVED Requirements

### Requirement: Persistence module loads and saves snapshots in localStorage with a 5MB cap

**Reason**: Client-side localStorage persistence is replaced by a server-authoritative tldraw sync store backed by a WebSocket sync server. Per-browser localStorage cannot satisfy multi-user collaboration (PRD US 24-28) because two clients see independent snapshots. The new persistence path is captured by the `multiplayer-sync` capability.

**Migration**: Delete `apps/web/src/canvas/persistence.ts` and `apps/web/src/canvas/persistence.test.ts`. Editor mount and edit persistence now flow through the sync store hook (`apps/web/src/canvas/use-sync-store.ts`); server-side debounced flush to `canvases.snapshot` is owned by `apps/api/src/sync/persistence.ts` (see `multiplayer-sync` spec).

#### Scenario: Persistence module is removed and not referenced

- **WHEN** the change is fully applied
- **THEN** the file `apps/web/src/canvas/persistence.ts` MUST NOT exist in the repository
- **AND** no module within `apps/web/src/canvas/` MUST import or call `loadSnapshot` or `saveSnapshot` against any localStorage-backed store

### Requirement: Editor autosaves snapshots on a debounced cadence and on page unload

**Reason**: Edit persistence is no longer initiated client-side. The Editor now mounts a tldraw sync store, which streams operations over WebSocket to the server-side room; server-side `apps/api/src/sync/persistence.ts` performs the debounced flush. The `beforeunload` flush is unnecessary because committed operations have already been forwarded to the server before unload.

**Migration**: Delete `apps/web/src/canvas/use-autosave.ts` and `apps/web/src/canvas/use-autosave.test.ts`. Remove the `useAutosave` import and call from `apps/web/src/canvas/Editor.tsx`. The localized key `canvas.chrome.persistence.quotaExceededToast` is removed from both locale files because the localStorage quota path no longer exists.

#### Scenario: Editor no longer subscribes to its own debounced autosave

- **WHEN** the change is fully applied
- **THEN** the file `apps/web/src/canvas/use-autosave.ts` MUST NOT exist in the repository
- **AND** `apps/web/src/canvas/Editor.tsx` MUST NOT import any `useAutosave` symbol
- **AND** `apps/web/src/canvas/Editor.tsx` MUST NOT register a `beforeunload` listener for the purpose of flushing tldraw store changes

## ADDED Requirements

### Requirement: Editor mounts with a multiplayer-aware sync store

The Editor component SHALL obtain a tldraw sync store via the `useSyncStore(canvasId)` hook (`apps/web/src/canvas/use-sync-store.ts`) and SHALL pass that store to the tldraw `<Tldraw>` component. The Editor SHALL NOT initialize tldraw with a local-only store, SHALL NOT call any client-side `loadSnapshot` or `saveSnapshot` function, and SHALL NOT register a `beforeunload` listener for the purpose of flushing edits.

#### Scenario: Editor mounts with a sync store bound to the current canvas id

- **WHEN** the Editor renders for `/canvas/<canvasId>`
- **THEN** the Editor MUST call `useSyncStore(<canvasId>)` exactly once and pass the returned store to `<Tldraw store={store} />`
- **AND** the Editor MUST NOT pass an `initialState` prop derived from localStorage

#### Scenario: Editor does not mount tldraw before the sync store reports a status

- **WHEN** the sync store hook reports status `connecting` and has not yet received the initial document from the server
- **THEN** the Editor MUST render a loading state instead of `<Tldraw>` so that no premature blank document is displayed

#### Scenario: Editor remounts cleanly when navigating between canvases

- **WHEN** the Editor unmounts and a new Editor mounts for a different canvas id
- **THEN** the previous sync store MUST be disposed and the new mount MUST establish a fresh sync store bound to the new id with no shared state across mounts

### Requirement: TopBar displays a real-time connection status indicator

The TopBar SHALL render a connection status indicator that reflects the current state of the sync WebSocket connection. The indicator SHALL display exactly one of four states: `connecting`, `connected`, `reconnecting`, `disconnected`. Each state SHALL use a localized label and SHALL be readable via screen reader through an `aria-label` whose text comes from a localized key. The indicator SHALL NOT use motion-based animation (per CLAUDE.md hard rule #5: multiplayer presence MUST be instant).

#### Scenario: Indicator reflects the active connection state

- **WHEN** the sync store reports state `connected`
- **THEN** the TopBar indicator MUST render with the localized label for `connected`
- **AND** the indicator's `aria-label` MUST come from the localized key for the current state

#### Scenario: Indicator transitions are reflected within one render cycle

- **WHEN** the sync connection transitions from `connected` to `reconnecting`
- **THEN** the indicator MUST update on the next render after the state change without polling

##### Example: state to localized key mapping

| Connection state | Localized label key | aria-label key |
| ---------------- | ------------------- | -------------- |
| connecting | `canvas.chrome.connection.connecting` | `canvas.chrome.connection.connecting` |
| connected | `canvas.chrome.connection.connected` | `canvas.chrome.connection.connected` |
| reconnecting | `canvas.chrome.connection.reconnecting` | `canvas.chrome.connection.reconnecting` |
| disconnected | `canvas.chrome.connection.disconnected` | `canvas.chrome.connection.disconnected` |

#### Scenario: Disconnected state shows a refresh banner

- **WHEN** the sync store transitions to `disconnected` after exhausting reconnect attempts
- **THEN** the TopBar MUST display a banner whose body comes from the localized key `canvas.chrome.connection.disconnectedBanner`
- **AND** the banner MUST contain a refresh action whose label comes from the localized key `canvas.chrome.connection.refresh`

### Requirement: TopBar displays the current collaborator avatar list

The TopBar SHALL render a list of avatars for every user currently connected to the same sync room as the local user. Each avatar SHALL be rendered using the existing `UserAvatar` component (`apps/web/src/components/UserAvatar.tsx`). The list SHALL display up to 4 avatars inline; any additional collaborators SHALL be represented by a single trailing badge with text `+N` where N is the count of collaborators not displayed inline. The list SHALL exclude the local user themselves.

#### Scenario: Single remote collaborator renders one avatar

- **WHEN** one remote user is connected to the same sync room as the local user
- **THEN** the TopBar MUST render exactly one `UserAvatar` element representing the remote user

#### Scenario: Five or more collaborators trigger overflow badge

- **WHEN** five or more remote users are connected to the same sync room
- **THEN** the TopBar MUST render exactly four `UserAvatar` elements followed by a single overflow badge whose text content matches `+N` where N is the count of collaborators not rendered inline

##### Example: avatar list overflow

| Remote collaborators connected | Avatars rendered | Overflow badge |
| ------------------------------ | ---------------- | -------------- |
| 0 | 0 | not rendered |
| 1 | 1 | not rendered |
| 4 | 4 | not rendered |
| 5 | 4 | `+1` |
| 12 | 4 | `+8` |

#### Scenario: Local user is excluded from the avatar list

- **WHEN** the local user is the only user in the sync room
- **THEN** the TopBar MUST render zero `UserAvatar` elements in the collaborator list region

#### Scenario: Collaborator presence updates without reload

- **WHEN** a remote user joins or leaves the sync room
- **THEN** the TopBar collaborator list MUST update on the next render without requiring a page reload or manual refresh
