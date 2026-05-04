# ADR-0008: Markdown engine — `marked` + `DOMPurify` for the Markdown shape

**Status:** Accepted
**Date:** 2026-05-04
**Decider:** project owner

## Context

M6 introduces the Markdown custom shape (per `add-custom-shapes`). The shape
must convert user-authored markdown (with GFM features: tables, task-lists,
strikethrough, autolink) into safe HTML for inline rendering. Three engines
are mature enough to consider: `marked`, `markdown-it`, and `unified +
remark`. Math (KaTeX) and Mermaid are explicit non-goals; raw HTML
pass-through is rejected on principle (XSS surface). The pipeline must be a
pure function so it can be unit-tested without DOM setup.

## Decision

Use `marked` (with its built-in GFM extensions: `gfm: true`, table support,
task-list extension, autolinker) followed by `DOMPurify` (run in the
happy-dom test env and the browser at runtime). The pipeline is wrapped in
a single deep module `apps/web/src/canvas/shapes/markdown-parser.ts`
exposing `parseMarkdown(input: string): string`. The function MUST NOT
throw, MUST strip `<script>` tags and inline event handlers, and MUST NOT
enable `breaks` or raw-HTML pass-through.

## Consequences

### Positive

- Smallest of the three engine families (marked is ~30 KB gzipped) — fits
  vellum's "lean main bundle" preference.
- Pure-function API; trivially testable. We can drive a parameterized table
  of (input → expected substring) cases straight from the spec example.
- No plugin ecosystem to manage; rejecting math / mermaid is a one-line
  config decision rather than ongoing dependency hygiene.
- DOMPurify is the de-facto standard sanitiser; happy-dom provides the
  required DOM API in the test env so we can hold real-DOM expectations.

### Negative / Trade-offs

- Less plugin selection than markdown-it; if M-future ever wants math or
  custom containers we may have to migrate. ADR will be revisited then.
- DOMPurify has a CVE history (sanitiser bypasses periodically discovered);
  must stay on the latest minor version. CI dependency audit covers this.

## Alternatives Considered

### A. `markdown-it`

Bigger plugin ecosystem and more configurable, but higher bundle cost and a
larger config surface. The plugin ecosystem is value we don't currently
need, so we'd be paying weight for nothing.

### B. `unified + remark + remark-html`

Most robust AST-based pipeline. Powerful but has the steepest setup curve
and adds 3+ packages for a use case where we don't need AST manipulation.
Over-engineered for M6.

### C. Roll our own

Rejected on sight: sanitisation is a security-critical surface; reusing a
maintained library is non-negotiable.
