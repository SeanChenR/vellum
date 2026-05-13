## ADDED Requirements

### Requirement: Locale toggle in the navbar switches the active i18n language

The system SHALL render a `<LocaleToggle />` button in the navbar's right region that displays the current locale as a short label (`中` for `zh-TW`, `EN` for `en`). Clicking the toggle SHALL switch between the two supported locales in place; the system SHALL NOT show a dropdown menu because there are exactly two locales. The new locale SHALL be applied via `i18n.changeLanguage(next)` and reflected in the toggle label on the same render cycle.

#### Scenario: Click toggles zh-TW to en

- **GIVEN** the document is currently in `zh-TW`
- **AND** the toggle shows `中`
- **WHEN** the user clicks the toggle
- **THEN** `i18n.language` MUST equal `en`
- **AND** the toggle label MUST become `EN`
- **AND** every visible string with an i18n key MUST re-render in English

#### Scenario: Click toggles en back to zh-TW

- **GIVEN** the document is currently in `en`
- **WHEN** the user clicks the toggle
- **THEN** `i18n.language` MUST equal `zh-TW`

### Requirement: Locale preference is persisted server-side when signed in

When the user is signed in, the system SHALL PATCH `/api/account/profile` with `{ locale: <next> }` after the local i18n switch succeeds. When the user is not signed in, no server call SHALL occur, and the locale SHALL persist only for the active i18next instance (already governed by `i18next-browser-languagedetector`).

#### Scenario: Server patch on signed-in toggle

- **GIVEN** an authenticated user whose stored locale is `zh-TW`
- **WHEN** the user toggles to `en`
- **THEN** the client MUST send `PATCH /api/account/profile` with body `{ "locale": "en" }`
- **AND** a 200 response MUST clear any pending toast

#### Scenario: No server call when signed out

- **GIVEN** an anonymous visitor on the homepage
- **WHEN** the user clicks the locale toggle
- **THEN** no request to `/api/account/profile` SHALL be made

#### Scenario: Server patch failure does not revert the UI

- **GIVEN** an authenticated user toggling locale to `en`
- **AND** the PATCH request fails with HTTP 500
- **THEN** the active UI MUST remain in English
- **AND** a toast MUST display the i18n key `nav.locale.serverPatchFailed`

### Requirement: Locale toggle replaces the ProfilePage locale field

The locale selector that previously lived in `apps/web/src/account/ProfilePage.tsx` SHALL be removed from the profile form. The ProfilePage form schema SHALL no longer include a `locale` field. The shared `<LocaleToggle />` is the only locale entry point in the UI.

#### Scenario: ProfilePage form has no locale select

- **GIVEN** the `/account/profile` route is rendered
- **THEN** the form MUST NOT contain any element labelled `account.profile.localeLabel`
- **AND** the form submit MUST NOT include a `locale` property in its payload
