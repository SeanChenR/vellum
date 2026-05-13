## MODIFIED Requirements

### Requirement: Cursor AI Badge surfaces aiActive presence flag

When a run dispatched from the local instance enters `running` state, the Side Panel SHALL set the local user's tldraw `instancePresence.meta.aiActive = true` by writing to the user's `TLInstancePresence` record via `editor.store.put`. When the run reaches any terminal state, the flag SHALL be reset to `false` on the same presence record. The flag SHALL ride the tldraw sync presence channel automatically so every collaborator in the same room sees the change. The CollaboratorAvatars chrome SHALL render an enhanced visual treatment (gradient golden border plus a sparkle SVG overlay) on any avatar whose presence row reports `meta.aiActive === true`. Only the boolean `aiActive` flag SHALL be broadcast through this channel — thread message content SHALL NEVER traverse the presence channel.

The previous implementation that wrote to `TLInstance.meta` via `editor.updateInstanceState` was local-only (TLInstance is not synced) and SHALL be replaced. The presence record id is derived from the user id via `InstancePresenceRecordType.createId(userId)`.

#### Scenario: Multi-tab badge visibility

- **GIVEN** user U1 on canvas C in tab A and user U2 on canvas C in tab B
- **WHEN** U1 starts an agent run in tab A
- **THEN** within 500ms the avatar representing U1 in tab B's CollaboratorAvatars SHALL display the gradient border and sparkle overlay
- **WHEN** the run terminates in tab A (any terminal state)
- **THEN** within 500ms the overlay SHALL disappear from tab B.

#### Scenario: Same-user multi-tab visibility

- **GIVEN** user U1 has the same canvas open in tab A and tab A'
- **WHEN** U1 starts an agent run in tab A
- **THEN** within 500ms tab A''s CollaboratorAvatars SHALL display the badge on U1's avatar
- **WHEN** the run terminates
- **THEN** the badge SHALL disappear in both tabs.

#### Scenario: Disconnect clears badge implicitly

- **GIVEN** U1 has `meta.aiActive=true` and is running an agent
- **WHEN** U1's WebSocket disconnects (network drop, browser close, server restart)
- **THEN** the sync presence row for U1 SHALL be removed from the collaborator list in all other tabs
- **AND** the overlay SHALL no longer appear for U1 in those tabs.

#### Scenario: Badge channel never carries thread content

- **GIVEN** an agent run is in progress and emitting assistant text + tool calls via SSE
- **WHEN** any collaborator inspects U1's `TLInstancePresence.meta`
- **THEN** the only AI-related field present SHALL be `aiActive: boolean`
- **AND** no field SHALL contain prompt text, assistant text, tool arguments, or tool results.
