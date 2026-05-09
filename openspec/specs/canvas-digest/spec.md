# canvas-digest Specification

## Purpose

TBD - created by archiving change 'add-agent-runtime-streaming'. Update Purpose after archive.

## Requirements

### Requirement: Digest header has fixed lightweight schema

The canvas digest builder SHALL produce a single header object per agent run with the following fields and only these fields: `canvasId` (string), `title` (string), `viewport` (object with `x`, `y`, `w`, `h` numbers), `selection` (array of `{ id: string, type: string }` references with no shape contents), `shapeCounts` (record of shape type to count), `bounds` (object with `x`, `y`, `w`, `h` numbers describing the bounding box of all shapes). The builder SHALL NOT include shape contents, props, or per-shape geometry beyond the listed fields. The header SHALL be derivable in O(N) over the canvas snapshot where N is shape count.

#### Scenario: Builder emits digest for a populated canvas

- **WHEN** the builder runs against a canvas with 12 markdown, 3 code, and 5 link shapes, current viewport `{x: 0, y: 0, w: 1920, h: 1080}`, and selection of two markdown shapes
- **THEN** the digest SHALL contain `shapeCounts: { markdown: 12, code: 3, link: 5 }`, `selection: [{id: "...", type: "markdown"}, {id: "...", type: "markdown"}]`, the supplied viewport rectangle, and the canvas bounds, and SHALL NOT contain any shape's `text`, `language`, `url`, or other content fields.

##### Example: digest schema

```json
{
  "canvasId": "cnv_abc",
  "title": "Sprint planning",
  "viewport": { "x": 0, "y": 0, "w": 1920, "h": 1080 },
  "selection": [
    { "id": "shape:md-1", "type": "markdown" }
  ],
  "shapeCounts": { "markdown": 12, "code": 3, "link": 5 },
  "bounds": { "x": -200, "y": -100, "w": 4000, "h": 2400 }
}
```


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Digest never contains full snapshot

The canvas digest SHALL NOT include the tldraw store snapshot, individual shape props, or any field whose size grows linearly with shape content. The agent SHALL retrieve such detail through the existing M12.2 read tools (`getShape`, `listShapesInViewport`, `listShapesInSelection`, `getCanvasBounds`, `getViewport`).

#### Scenario: Canvas contains very large markdown shape

- **GIVEN** a canvas containing one markdown shape with 50,000 characters of body text
- **WHEN** the digest builder runs
- **THEN** the resulting digest SHALL contain `shapeCounts: { markdown: 1 }` plus the structural fields, SHALL NOT contain the markdown body text, and SHALL NOT exceed a size proportional to (shape count + selection count + shape-type kinds).


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Digest is computed once per run

The canvas digest builder SHALL produce exactly one digest per agent run at run start. The digest SHALL NOT be recomputed within the same run even if the canvas changes via tool calls. Updates to the canvas state observed by the agent during the run SHALL come from tool result payloads, not from a refreshed digest.

#### Scenario: Tool call modifies canvas mid-run

- **GIVEN** the digest header has been emitted with `shapeCounts.markdown: 12`
- **WHEN** the agent calls `createShape` for a new markdown shape during the same run
- **THEN** the runtime SHALL NOT emit a new digest, and the agent's awareness of the new shape SHALL come from the `tool_result` payload of the `createShape` call.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Builder reuses existing readers

The canvas digest builder SHALL derive its fields from the existing readers `getViewport`, `getCanvasBounds`, and the canvas snapshot accessor used by `listShapesInViewport`. The builder SHALL NOT introduce a parallel snapshot path that bypasses M12.2 reader deps.

#### Scenario: Reader deps are injected, not constructed inline

- **WHEN** the builder is invoked
- **THEN** it SHALL accept `MutatorReadersDeps` as a parameter and SHALL invoke the same accessor functions used by M12.2 readers, so a test can inject a fake snapshot through one shared deps object.

<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->