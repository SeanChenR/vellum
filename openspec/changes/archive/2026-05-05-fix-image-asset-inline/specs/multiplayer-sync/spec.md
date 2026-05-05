## ADDED Requirements

### Requirement: Tldraw asset store inlines image uploads as same-origin data URLs

The client-side `TLAssetStore.upload` implementation in `apps/web/src/canvas/use-sync-store.ts` SHALL accept any of the supported image MIME types (`image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`), encode the file contents as a `data:` URL, and return `{ src }` so tldraw's built-in image shape can render the result. This replaces the prior "always throw" behavior. Uploads SHALL be performed entirely client-side: NO HTTP request is issued to any backend endpoint and NO blob storage / CDN integration is performed (those remain Phase 2 scope).

The encoded `src` SHALL be persisted as part of the canvas snapshot via tldraw sync, so reloading the page or re-syncing from another client renders the image without a re-upload.

A pure helper function `inlineImageAsset(file: File): Promise<{ src: string }>` SHALL live in `apps/web/src/canvas/asset-inline.ts`. The asset-store wrapper SHALL delegate to this helper. Encoding rules:

- `image/svg+xml`: read with `file.text()`, sanitize via DOMPurify with the SVG profile (`USE_PROFILES: { svg: true, svgFilters: true }`), then `data:image/svg+xml;utf8,${encodeURIComponent(sanitized)}`.
- Other supported MIME types: `data:${mime};base64,${btoa(<bytes>)}` where bytes come from `file.arrayBuffer()`.

#### Scenario: PNG upload renders inline

- **WHEN** the user uploads a 100 KB PNG file via the tldraw image tool
- **THEN** the resulting image shape's asset MUST have `src` starting with `"data:image/png;base64,"` and the canvas MUST display the image; NO outbound HTTP request to any vellum endpoint is issued

#### Scenario: SVG upload is sanitized before encoding

- **WHEN** the user uploads an SVG whose contents contain a `<script>alert(1)</script>` element
- **THEN** the resulting `src` data URL MUST NOT contain the `<script>` tag (case-insensitive substring check) and the canvas MUST still render the rest of the SVG markup

##### Example: SVG sanitisation

| Input fragment | Expected behavior |
| -------------- | ----------------- |
| `<svg><script>x()</script><circle r="5"/></svg>` | result `src` decoded MUST contain `<circle` and MUST NOT contain `<script` |
| `<svg><image onclick="x()" href="a.png"/></svg>` | result `src` decoded MUST NOT contain `onclick=` |
| `<svg><foreignObject><iframe/></foreignObject></svg>` | result `src` decoded MUST NOT contain `<iframe` |

#### Scenario: Image survives reload

- **WHEN** a user uploads an image, then reloads the page
- **THEN** the image shape MUST re-render with the same content (the snapshot persisted the data URL)

### Requirement: Asset store rejects oversize and unsupported uploads with localized errors

`inlineImageAsset` and the wrapping asset-store upload SHALL reject files in two cases by throwing an `Error` whose `message` is exactly the i18n errorKey:

- File size strictly greater than `5 * 1024 * 1024` bytes → `errors.image.tooLarge`
- File MIME type not in the supported set (`image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`) → `errors.image.unsupportedFormat`

These errorKeys MUST be present in both `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` under `errors.image`. The tldraw editor surfaces upload errors as a toast with the thrown message, so the toast layer SHALL look up the errorKey via `t(error.message)` to display the translated string.

The pre-throw checks MUST happen BEFORE any expensive read (`file.arrayBuffer()` / `file.text()`) so a 50 MB BMP rejects in O(1) without holding bytes in memory.

#### Scenario: 6 MB PNG rejected

- **WHEN** the user uploads a 6 MB PNG file
- **THEN** `inlineImageAsset` MUST throw an `Error` with `message === "errors.image.tooLarge"` and MUST NOT call `file.arrayBuffer()` (no expensive read attempted)

#### Scenario: PDF upload rejected

- **WHEN** the user uploads a file whose MIME type is `application/pdf`
- **THEN** `inlineImageAsset` MUST throw an `Error` with `message === "errors.image.unsupportedFormat"`

#### Scenario: HEIC upload rejected

- **WHEN** the user uploads a file whose MIME type is `image/heic`
- **THEN** `inlineImageAsset` MUST throw an `Error` with `message === "errors.image.unsupportedFormat"` (HEIC is intentionally Phase 1 out-of-scope)

#### Scenario: Localized error keys present in both locales

- **WHEN** the change is committed
- **THEN** `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` MUST both contain the keys `errors.image.tooLarge` and `errors.image.unsupportedFormat`
