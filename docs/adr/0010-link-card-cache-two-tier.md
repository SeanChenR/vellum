# ADR-0010: Link card cache — snapshot + server LRU two-tier strategy

**Status:** Accepted
**Date:** 2026-05-04
**Decider:** project owner

## Context

The Link card shape (M6) shows an Open Graph preview for a user-supplied
URL. Two cache concerns need addressing:

1. When a user reloads the canvas, the link card should not flash white
   waiting for a re-fetch — last successful metadata should render
   immediately.
2. The canvas owner could click "Refresh" repeatedly, hammering the remote
   site. We have a per-user rate limit (30 req/min on `POST /api/og`), but
   a second-layer cache prevents the server from making any outbound
   request when one was already served recently.

Either cache alone is insufficient: pure client-side cache means every
canvas reload would still depend on the network if `fetchedAt` is stale,
and pure server-side cache means a fresh page load with a cold server LRU
forces a re-fetch even when the canvas snapshot already has metadata.

## Decision

Use a **two-tier cache**:

**Tier 1 — Snapshot (client-side, persistent):** the link card shape's
own props store the last successful `metadata` and `fetchedAt`. This
ships in the tldraw sync snapshot and persists in the canvas's jsonb
column. Re-renders use this immediately; no network needed.

**Tier 2 — Server LRU (in-memory, transient):** `apps/api/src/og/index.ts`
keeps an LRU keyed by normalized URL with a 30-minute TTL. Hits don't
issue an outbound request. Resets on server restart (acceptable —
worst-case is one outbound fetch per URL after a deploy).

**Re-scrape triggers (i.e. when to invalidate Tier 1):**
1. URL changed by the user
2. `fetchedAt` is older than 24 hours (auto-refresh on render)
3. User clicks the explicit "Refresh" button

## Consequences

### Positive

- **No flash on reload** — Tier 1 makes the card render instantly from
  the snapshot.
- **Outbound traffic minimised** — Tier 2 absorbs bursts within 30 min;
  Tier 1 absorbs them across reloads.
- **No DB dependency** — both tiers are zero-DB-write (snapshot is
  already persisted; LRU is in-memory).
- **Trivially testable**: pure parser tested against HTML fixtures; LRU
  hit tested by issuing two requests and asserting only one outbound
  fetch.

### Negative / Trade-offs

- 24-hour staleness budget means a card can show outdated metadata for up
  to a day. Mitigated by the "Refresh" button. Acceptable for personal
  notes / link library use case.
- LRU lost on server restart — first request after deploy pays a fetch.
  Single-process Bun.serve makes this rare; acceptable.
- og:image hotlinking is the current image strategy (M6 explicit non-
  goal: no server-side image proxy). Image referrer leak risk and
  third-party image breakage. Mitigation: `<img onError>` falls back to
  the placeholder. Phase 2 may revisit with an image proxy.

## Alternatives Considered

### A. Snapshot only

Rejected: a determined "Refresh" button could bypass the snapshot and
still hammer the remote site. Server-side throttling is needed for
defence in depth even with rate limit.

### B. Server LRU only

Rejected: every canvas reload would re-fetch unless the LRU happened to
be warm. Visible latency on slow remotes, plus poor offline experience
(Phase 2 PWA) without snapshot.

### C. Persist server-side cache to DB (e.g. `link_card_cache` table)

Rejected as over-engineered. LRU + snapshot already cover both axes; a
DB table would survive restarts but the marginal benefit (one outbound
fetch saved per URL per server restart) doesn't justify the migration,
schema complexity, and operational surface.
