## ADDED Requirements

### Requirement: System provides E2E coverage for the five PRD happy paths

The system SHALL provide a Playwright E2E spec for each of the five Phase 1 PRD happy paths defined in `docs/PRD.md` lines 266–272: (1) Login via Magic Link, (2) Canvas CRUD (create / rename / move into folder / delete), (3) Sharing (invite + accept), (4) Multiplayer (two browser contexts editing the same canvas), and (5) Export (open canvas → MainMenu → PNG download). Each spec MUST live under the `e2e/` directory and MUST pass three consecutive runs without retries (`--retries=0`) when executed against a local development server.

#### Scenario: Login flow has an E2E spec

- **WHEN** the contributor runs `bun run test:e2e e2e/auth-magic-link.spec.ts` against a local dev server
- **THEN** the spec MUST execute the full Magic Link login flow (request link → simulate clicking the link via test-mode token → land on `/dashboard`) and pass

#### Scenario: Canvas CRUD has an E2E spec

- **WHEN** the contributor runs `bun run test:e2e e2e/canvas-crud.spec.ts` against a local dev server
- **THEN** the spec MUST execute create canvas → rename canvas → create folder → drag canvas into folder → delete canvas → delete folder, with each step verifiable via visible DOM assertions, and pass

#### Scenario: Sharing has an E2E spec covering invite and accept

- **WHEN** the contributor runs `bun run test:e2e e2e/share-invite.spec.ts e2e/sharing-acceptance.spec.ts` against a local dev server
- **THEN** both specs MUST pass and together cover the invite-by-email flow, the invitee accept flow, and the resulting visibility of the shared canvas to both parties

#### Scenario: Multiplayer has an E2E spec

- **WHEN** the contributor runs `bun run test:e2e e2e/multiplayer-sync.spec.ts` against a local dev server
- **THEN** the spec MUST open two browser contexts on the same canvas, perform an edit in one context, observe the edit propagate to the other, and pass

#### Scenario: Export has an E2E spec for PNG download

- **WHEN** the contributor runs `bun run test:e2e e2e/export-png.spec.ts` against a local dev server
- **THEN** the spec MUST sign in, open a canvas, draw a non-empty shape, trigger Export → PNG → 1× from the MainMenu, observe a Playwright download event, verify the download filename matches `{slug(canvas.title)}.png`, and pass

##### Example: PRD happy path → spec file mapping

| PRD happy path | Spec file | Status before this change |
| --- | --- | --- |
| 1. Login (Magic Link) | `e2e/auth-magic-link.spec.ts` | exists |
| 2. Canvas CRUD | `e2e/canvas-crud.spec.ts` | NEW (this change) |
| 3. Sharing | `e2e/share-invite.spec.ts` + `e2e/sharing-acceptance.spec.ts` | exist (debt — needs verification) |
| 4. Multiplayer | `e2e/multiplayer-sync.spec.ts` | exists |
| 5. Export PNG | `e2e/export-png.spec.ts` | NEW (this change) |

---

### Requirement: A pre-push smoke subset of E2E specs runs before each git push

The system SHALL provide a `test:e2e:smoke` package script that runs a subset of the E2E suite consisting of three specs: the smoke baseline (`smoke.spec.ts`), the auth Magic Link login (`auth-magic-link.spec.ts`), and the Canvas CRUD happy path (`canvas-crud.spec.ts`). The system SHALL register a Husky `pre-push` hook that invokes `bun run test:e2e:smoke`. A failed smoke run MUST block the push. The contributor MUST be able to bypass the hook with `git push --no-verify` when intentional. The full E2E suite (all nine specs) MUST remain available via `bun run test:e2e` for manual / on-demand execution.

#### Scenario: Smoke runs on git push

- **WHEN** the contributor invokes `git push` after committing changes
- **THEN** the Husky `pre-push` hook MUST execute `bun run test:e2e:smoke`
- **AND** the push MUST proceed only if all smoke specs pass

#### Scenario: Full suite remains accessible manually

- **WHEN** the contributor runs `bun run test:e2e` (no spec filter)
- **THEN** Playwright MUST execute every spec under `e2e/` (currently nine specs plus the two new ones in this change, totalling at least eleven)

#### Scenario: Failed smoke blocks the push

- **WHEN** any smoke spec fails during a `pre-push` invocation
- **THEN** Husky MUST exit with a non-zero status
- **AND** the push MUST NOT proceed unless the contributor adds `--no-verify`

---

### Requirement: Dashboard data layer reaches at least 60% line coverage

The system SHALL ensure that the three dashboard data-layer modules — `apps/web/src/dashboard/DashboardPage.tsx`, `apps/web/src/dashboard/useCanvasList.ts`, and `apps/web/src/dashboard/useFolderList.ts` — each reach at least 60% line coverage as reported by `bun test apps/web --coverage`. The new tests MUST exercise: dialog state transitions in DashboardPage (the eight `DialogState` kinds and the active-folder-to-shared-view transition); mutation success paths in useCanvasList (renameCanvas / deleteCanvas / createCanvas / moveCanvas) and useFolderList (createFolder / renameFolder / deleteFolder), each verifying the appropriate React Query cache invalidation; and the deleteFolder error path when the folder is non-empty.

#### Scenario: Dashboard modules report 60%+ line coverage

- **WHEN** `bun test apps/web --coverage` is run
- **THEN** each of the three listed dashboard modules MUST report at least 60% line coverage

#### Scenario: useCanvasList renameCanvas mutation invalidates the canvas list query

- **WHEN** a test invokes `renameCanvas.mutate({ id, title })` and the mutation resolves successfully
- **THEN** the test MUST observe a cache invalidation on the canvas-list query key
- **AND** subsequent reads MUST refetch the list from the server

#### Scenario: useFolderList deleteFolder error surfaces the not-empty error key

- **WHEN** the server returns the error key `errors.folder.notEmpty` from a deleteFolder mutation
- **THEN** the hook MUST expose that error key to the caller without crashing
- **AND** the cache for the folder-list query MUST NOT be invalidated by the failed mutation

---

### Requirement: README documents Phase 1 completion and contributor onboarding

The system SHALL provide a top-level `README.md` containing the following sections in this order: project description (one sentence), Status (Phase 1 milestone completion table M1–M10 with checkmarks and the next planned version), Quick Start (install + dev server + database + Mailpit + dashboard URL), Stack (per-layer table of tools), Repo Layout (tree of `apps/`, `packages/`, `docs/`, `e2e/`, `openspec/`), Common Commands (test / lint / typecheck / e2e / build / database migrations / spectra), Test Strategy (unit + integration + E2E layers with the 70% line-coverage target and Playwright as the E2E framework), Architecture (the single-binary Bun.serve HTTP+WS+static layout and the tldraw sync hook), Capabilities (a list of every capability under `openspec/specs/` with a one-line description), ADR Index (every file in `docs/adr/` with a one-line takeaway), Spectra Workflow (the discuss → propose → apply → archive pipeline), and Phase 2 Roadmap (a brief reference to the deploy checklist without expanding it).

#### Scenario: README contains every required section

- **WHEN** the README is read
- **THEN** every one of the twelve listed sections MUST be present with non-empty content

#### Scenario: ADR Index has one entry per ADR file

- **WHEN** every file under `docs/adr/` matching `0\d\d\d-*.md` is enumerated
- **THEN** each MUST have exactly one corresponding line in the README's ADR Index section

#### Scenario: Capabilities section lists every spec

- **WHEN** every directory under `openspec/specs/` is enumerated
- **THEN** each MUST have exactly one corresponding line in the README's Capabilities section
