# ADR-0011: Image asset upload — Phase 1 inline data URL, Phase 2 cloud upload

**Status:** Accepted
**Date:** 2026-05-05
**Decider:** project owner

## Context

The `add-canvas-editor-shell` change embedded tldraw with a `TLAssetStore`
whose `upload()` method always threw, on the basis that "image cloud
upload is Phase 2" per the PRD's out-of-scope guard. M6 acceptance
surfaced the consequence: the built-in image shape was completely
unusable — no SVG / PNG / JPEG / GIF / WebP would render, since tldraw
needs a `src` and the throw left the asset record without one.

Re-reading the PRD: "image cloud upload" was scoped to Phase 2 to mean
"don't build server-side blob storage / S3 / CDN integration" — not "no
images visible in Phase 1". Phase 1 (single-instance, local-only) can
honor the spirit of the constraint while still making the image tool
work, by inlining the file into the tldraw asset record itself.

## Decision

Replace the throwing `upload` with a Phase 1 client-side inline encoder:

- **`image/svg+xml`**: read with `file.text()`, sanitize with DOMPurify
  using its SVG profile (`USE_PROFILES: { svg: true, svgFilters: true }`),
  then `data:image/svg+xml;utf8,${encodeURIComponent(safe)}`.
- **`image/png` / `image/jpeg` / `image/gif` / `image/webp`**: read with
  `file.arrayBuffer()` and emit `data:${mime};base64,${b64}`.
- **5 MB cap** + **MIME whitelist** before any expensive read; rejection
  throws `Error("errors.image.tooLarge")` or
  `Error("errors.image.unsupportedFormat")` — tldraw surfaces this as a
  toast, the toast layer translates the i18n key.

The encoder lives in a dedicated deep module
(`apps/web/src/canvas/asset-inline.ts`) so it is unit-testable without
the tldraw editor.

## Consequences

### Positive

- **Image tool works in Phase 1** — SVG / PNG / JPEG / GIF / WebP all
  render; survives reload because the data URL is part of the snapshot.
- **Zero server changes** — no API endpoint, no DB schema change, no
  blob storage. Honors PRD's "no cloud upload in Phase 1".
- **SVG is sanitized** — DOMPurify SVG profile strips `<script>`,
  inline event handlers, `<foreignObject>`, etc. Phase 1 can't ship a
  silent XSS vector through the file picker.
- **Pure helper unit-testable** — XSS / size / MIME / encoding all
  testable as a parameterized table without spinning up tldraw.
- **Phase 2 swap is local** — replacing `inlineImageAsset(file)` with
  `uploadToCdn(file)` is a one-file change; the rest of the asset-store
  wiring is untouched.

### Negative / Trade-offs

- **Snapshot bloat**: a 5 MB image embeds 5 MB of base64 (≈ 6.7 MB
  encoded) into the canvas's jsonb snapshot. Phase 1 single-instance
  postgres handles this; Phase 2 cloud upload should cut it back.
- **Repeated WS sync of large payloads**: every reconnect/resync
  re-transmits the whole base64 to all clients. Acceptable for Phase 1
  (small user count, small images); worth fixing in Phase 2 alongside
  cloud upload.
- **5 MB cap is conservative**: phone-camera shots often exceed 5 MB.
  Phase 2 cloud upload should raise the cap once the bytes don't have
  to fit in a snapshot.
- **DOMPurify CVE history**: SVG sanitisation has had bypasses
  historically. Defense-in-depth: tldraw renders the image via
  `<img src="data:image/svg+xml,...">`, and modern browsers don't
  execute `<script>` inside `<img>`-loaded SVG (only inline `<svg>`
  embedded in HTML can execute). Two layers, not one.
- **Main-thread cost on encoding**: 5 MB `arrayBuffer + btoa` on the
  main thread blocks for ~50–100 ms on commodity hardware. Acceptable
  per upload; revisit (offload to a Worker) when Phase 2 raises the cap.

## Phase 2 Migration

When `add-image-cloud-upload` lands, the migration is:

1. Server gains a `POST /api/asset/upload` endpoint backed by S3 (or
   equivalent), behind auth + rate limit + virus scan.
2. `inlineImageAsset(file)` is replaced with `uploadToCdn(file)` (same
   signature, different `src` shape: `https://cdn.../...` instead of
   `data:...`).
3. A one-shot migration job rewrites existing snapshots: scan asset
   records whose `props.src` starts with `data:`, decode, upload to S3,
   replace `src` with the CDN URL. The job MUST run inside a
   transaction per canvas + emit `multiplayer-sync` snapshot version
   bump.
4. Cap can be raised; size limit moves to the upload endpoint.

## Alternatives Considered

### A. Stay with throw, defer to Phase 2

Rejected: leaves a visible Phase 1 hole that contradicts "完整不做一半"
and blocks meaningful demos / dogfood.

### B. Build cloud upload now (skip Phase 1 inline)

Rejected: violates the PRD's Phase 1 / Phase 2 split. Building S3 +
auth + rate-limit + lifecycle for a single-user demo is over-engineering;
the ROI hits only when multi-user / multi-canvas scale starts.

### C. Browser IndexedDB cache + asset reference

Rejected: would need a custom asset resolver that reads from IndexedDB
on render. Doesn't survive sharing the canvas across devices (other
clients can't read the originator's IndexedDB), so it fails the basic
"upload an image and have someone else see it" test that vellum cares
about.
