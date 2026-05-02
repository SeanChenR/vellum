# ADR-0007: Sharing — viewer-downgrade in-flight writes and public-link rotation as the only revocation knob

**Status:** Accepted
**Date:** 2026-05-03
**Decider:** project owner

## Context

`add-sharing` (M5) extends `multiplayer-sync` (M4) with three new connection
identities: shared editor, shared viewer, and anonymous public-link visitor.
Two trade-offs surfaced during design that affect how aggressively the
server can rescind access; both are accepted in Phase 1 but worth recording
so future contributors do not silently relitigate.

## Decision

### 1. Role downgrade does not interrupt in-flight writes

When the owner changes a member's role from `editor` to `viewer`, the share
endpoint invokes
`syncServer.notifyAccessRevoked(canvasId, { kind: 'user', userId })`,
which closes that user's open WebSockets with code `4403`. The client
reconnects, the handshake re-resolves the role from `canvas_shares`, and
the new session is registered with `isReadonly: true`.

**What this does NOT do:** between the role change and the WebSocket
close, the editor session can still send pending mutations the room will
broadcast. There is no per-op permission filter applied to messages in
flight. A determined editor can theoretically race their last writes
through during the close window.

### 2. Public-link rotation is the only post-leak remedy

`canvas_share_links.token` is a 32-byte secret. Once an owner copies the
link, anyone with the URL can join via `mode=view` or `mode=edit` until
the owner explicitly rotates the token. There is no per-IP block, no
per-device fingerprint, no time-bound link. Rotation invalidates the
previous token immediately and closes any anonymous WebSockets bound to
it (`{ kind: 'all-anonymous' }`).

## Consequences

### Positive

- The architecture stays simple: a single revocation hook in the sync
  server is enough to rescind both per-user and anonymous access.
- The close-on-revoke path is fast (close code 4403 + reconnect) and the
  client UI shows it via the M4 disconnected banner.
- Public-link semantics match user expectations from Figma / Notion / Loom:
  the link is the password, rotation is the kill switch.

### Negative / Trade-offs

- **Up to ~one round-trip of edits can leak past a downgrade.** For Phase
  1, this is acceptable because (a) the use case is collaborative, not
  adversarial — owners rarely race against malicious editors, and
  (b) closing the upgrade window further would require server-side op
  filtering, which adds complexity without meaningful real-world coverage.
- **A leaked public-link URL has no automatic mitigation.** The owner
  must notice and rotate. Phase 2 may add: time-bound links, audit logs,
  per-IP throttling — none of which fit within Phase 1's scope.

## Alternatives Considered

### A. Per-op permission filter on the server

Inspect every push message and reject diffs from sessions whose role no
longer matches. Rejected: complicates the sync server's hot path, requires
shadowing tldraw's protocol layer, and the gain (closing a sub-second
window) is small.

### B. Pre-emptive role change → close → re-open

Have the share-handler call `notifyAccessRevoked` BEFORE updating the
DB row. Rejected: opens a brief window where the user's session is
already closed but the new role hasn't been recorded yet, leading to
flapping. The current order (DB first, then revoke) is consistent.

### C. Time-bound public links

Add `expires_at` to `canvas_share_links`. Rejected for Phase 1 because
the simplest UX is "owner rotates when they want to revoke" — adding a
TTL forces the owner to track expiry separately. Phase 2 may revisit if
audit log demand surfaces.
