## ADDED Requirements

### Requirement: Static i18n audit fails when JSX contains hardcoded display strings

The system SHALL provide a static lint-style test (`apps/web/src/i18n-audit.test.ts`) that scans every TypeScript and TSX source file under `apps/web/src/` (excluding test files and generated CSS) and fails when it finds any hardcoded display string in JSX text nodes or in user-visible JSX attributes (such as `aria-label`, `placeholder`, `title`, `alt`). A "hardcoded display string" is any literal string in those positions that is not produced by a `t(...)` call. The audit MUST allow a small enumerated set of exceptions: the brand name `Vellum`, version strings matching the pattern `v\d+(\.\d+)*`, single punctuation characters such as `…`, `·`, `×`, `→`, `+`, single ASCII characters, pure digits, and Unicode emoji. The audit MUST NOT inspect non-display attributes (such as `className`, `role`, `data-*`, event handler names).

#### Scenario: Audit fails on a hardcoded text node

- **WHEN** any source file under `apps/web/src/` contains a JSX expression of the form `<button>Cancel</button>` (a literal display string outside the allowlist)
- **THEN** the i18n-audit test MUST fail
- **AND** the failure message MUST include the file path, the line number, and the offending literal content

#### Scenario: Audit passes when all display strings come from t(key)

- **WHEN** every JSX text node and user-visible attribute in the scanned source files is either (a) an `{t("...")}` expression, (b) an interpolated expression `{...}`, (c) absent, or (d) a member of the allowlist
- **THEN** the i18n-audit test MUST pass

#### Scenario: Audit ignores attributes that are not user-visible

- **WHEN** a JSX element has attributes such as `className="..."`, `role="dialog"`, `data-testid="..."`, or `id="..."` with literal string values
- **THEN** the i18n-audit test MUST NOT flag those literals

##### Example: allowlist coverage

| JSX literal       | Position             | Allowlisted? | Audit verdict |
| ----------------- | -------------------- | ------------ | ------------- |
| `Vellum`          | text node            | yes          | pass          |
| `v0.9.0`          | text node            | yes (matches `v\d+(\.\d+)*`) | pass |
| `Cancel`          | text node            | no           | fail          |
| `…`               | text node            | yes          | pass          |
| `12`              | text node            | yes          | pass          |
| `🎨`              | text node            | yes          | pass          |
| `flex items-center` | className          | n/a          | pass (not inspected) |
| `dialog`          | role attribute        | n/a          | pass (not inspected) |
| `Cancel`          | aria-label            | no           | fail          |
| `your@email.com`  | placeholder           | no           | fail          |

---

### Requirement: All visible Dashboard, Auth, and Account display strings come from i18n

The system SHALL ensure that every JSX text node and every user-visible JSX attribute in the following source files goes through `t(key)`: `apps/web/src/components/CanvasRenameDialog.tsx`, `apps/web/src/components/FolderDeleteDialog.tsx`, `apps/web/src/components/CanvasMoveDialog.tsx`, `apps/web/src/components/CanvasCreateDialog.tsx`, `apps/web/src/components/CanvasDeleteDialog.tsx`, `apps/web/src/components/FolderCreateDialog.tsx`, `apps/web/src/components/FolderRenameDialog.tsx`, `apps/web/src/canvas/ShareDialog.tsx`, `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/account/DeleteAccountDialog.tsx`, `apps/web/src/dashboard/DashboardPage.tsx`, `apps/web/src/landing/PublicLayout.tsx`. Both `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` MUST define every i18n key referenced from these files in the same change.

#### Scenario: i18n audit passes after the cleanup

- **WHEN** the i18n-audit test runs after the cleanup is complete
- **THEN** the test MUST report zero violations across the listed files

#### Scenario: zh-TW and en locale files share the same key set

- **WHEN** the union of keys present in zh-TW.json and en.json is compared
- **THEN** every key in zh-TW MUST exist in en, and vice versa
- **AND** every translated string MUST be a non-empty value

---

### Requirement: i18n audit runs as part of the project test suite

The system SHALL include the i18n-audit test in the default Bun test run, so that running `bun test` (with no arguments or with the standard apps/web filter) executes the audit and surfaces violations as test failures. The audit MUST NOT require a special CLI flag, environment variable, or manual invocation to run.

#### Scenario: Default test run includes the audit

- **WHEN** a contributor runs `bun test apps/web` (or the equivalent default command)
- **THEN** the i18n-audit test MUST execute as part of the run
