# ADR-0004: Defer Hosting Decision Until Phase 1 is Complete

**Status:** Accepted
**Date:** 2026-04-29
**Decider:** project owner (grill-me)

## Context

Vellum's PRD targets a "complete public free tool" feel, which usually implies a deployed instance with a domain, HTTPS, and uptime. The candidate hosting paths are:

- Fly.io (~$5/mo minimum — free tier removed in 2024)
- Railway (~$5/mo minimum — free tier removed in 2023)
- Render free tier (spins down on idle, kills WebSocket connections — incompatible with collab)
- Self-hosted VPS (Hetzner / DigitalOcean, ~$4–5/mo, full sysadmin work)
- Cloudflare Tunnel + home machine ($0 but laptop-uptime-bound)
- Oracle Cloud Always Free (real $0 but unreliable account stability)
- GCP Cloud Run (free tier exists but cold-start kills persistent WebSocket UX)

The owner expressed two motivations: (i) does not want to pay $5/mo for an unannounced project, (ii) does not want to deal with deployment ops mid-phase-1.

## Decision

**Defer the hosting decision until Phase 1 is feature-complete on localhost.**

The architecture is intentionally hosting-agnostic (Bun single-process serves HTTP + WebSocket + static assets). All decisions in Phase 1 — auth, persistence, multiplayer, sharing, custom shapes — work identically on localhost as they would in any of the candidate hosting options.

When Phase 1 wraps, the deploy options remain open:

- **$0 path:** Cloudflare Tunnel from a home machine
- **$5/mo path:** Fly.io (recommended for the Bun + WebSocket use case)
- **$5/mo simpler path:** Railway

A `project_deploy_checklist.md` memory captures the items Phase 1 deferred (Sentry integration, secrets store migration, HTTPS, CORS, CSP headers, migration flow verification) so the eventual deploy session has a clear todo list.

## Consequences

### Positive

- No premature commitment to a hosting vendor or recurring cost.
- Avoids vendor-lock effort (e.g., Railway-specific config) before knowing whether the project will ship.
- Owner's velocity is preserved by removing the deploy task from Phase 1's mental load.
- Dev experience identical to prod intent: same Bun process, same architecture.

### Negative / Trade-offs

- The "complete public free tool" success definition is partially aspirational during Phase 1 — multiplayer collab is technically buildable but only testable with two browser tabs on localhost, not with actual remote users.
- Public-link sharing semantics are scaffolded but cannot be exercised end-to-end with non-local users until deployment.
- Risk of Phase 1 ending with "it works on localhost" and the deploy step never happening. Mitigated by the deploy checklist memory and the explicit Phase 2 transition guidance.

## Alternatives Considered

### A. Pick Fly.io now and deploy from M1 onward

Rejected. Owner does not want $5/mo cost or deploy ops during Phase 1. The architecture being hosting-agnostic means there's no technical reason to commit early.

### B. Pick Cloudflare Tunnel + home machine now ($0)

Rejected as the *primary* path, but kept as a candidate for the final decision. Deferring leaves all options open including this one.

### C. Pick Railway

Briefly chosen during the grill, then reverted to deferred per owner preference. The deferral preserves Railway as a candidate without committing.

### D. GCP

Rejected outright (see grill-me transcript): Cloud Run scale-to-zero kills persistent WebSocket UX; min-instances pricing is more expensive than Fly.io; e2-micro free tier is too small.
