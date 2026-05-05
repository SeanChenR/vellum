/**
 * asset-inline — Phase 1 client-side image upload encoder.
 *
 * Pure helper used by `useSyncStore`'s `TLAssetStore.upload`. Accepts a
 * `File`, encodes it as a `data:` URL, and returns `{ src }`. Throws an
 * `Error` whose `message` is the i18n errorKey when the file is too
 * large or its MIME isn't supported — tldraw's editor surfaces the
 * error as a toast, which the toast layer then translates.
 *
 * Encoding rules (per ADR-0011):
 *  - `image/svg+xml`: read as text, sanitise via DOMPurify SVG profile,
 *    emit `data:image/svg+xml;utf8,${encodeURIComponent(safe)}`.
 *  - `image/png` / `image/jpeg` / `image/gif` / `image/webp`: read as
 *    bytes, emit `data:${mime};base64,${b64}`.
 *
 * Size cap is checked BEFORE any `text()` / `arrayBuffer()` call so a
 * rejection is O(1) and never holds the bytes in memory.
 *
 * Spec: multiplayer-sync — "Tldraw asset store inlines image uploads"
 * + "Asset store rejects oversize and unsupported uploads with
 * localized errors".
 */

import DOMPurify from "dompurify";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MIMES = new Set<string>([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export interface InlinedAsset {
  src: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function ensureSvgNamespace(raw: string): string {
  return raw.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
    if (/\bxmlns\s*=/.test(attrs)) return `<svg${attrs}>`;
    return `<svg xmlns="${SVG_NS}"${attrs}>`;
  });
}

/**
 * Pre-strip dangerous tag blocks before handing the SVG to DOMPurify.
 *
 * DOMPurify's SVG profile in some DOM implementations (notably
 * happy-dom in our test environment) bails out and returns an empty
 * <svg></svg> when the very first child of the root is `<script>` —
 * even though the profile's job is to strip exactly that. Pre-stripping
 * those blocks here keeps the rest of the SVG intact and DOMPurify
 * still runs to remove inline event handlers and any other nasties.
 *
 * This is defence-in-depth: DOMPurify is still the primary sanitizer.
 */
function preStripDangerousBlocks(raw: string): string {
  return raw
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, "");
}

function bytesToBase64(bytes: Uint8Array): string {
  // btoa needs a string of code points 0..255; build it in chunks to
  // avoid `Maximum call stack size exceeded` on multi-megabyte files
  // (String.fromCharCode applied with apply has an arg-count cap).
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function inlineImageAsset(file: File): Promise<InlinedAsset> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("errors.image.tooLarge");
  }
  if (!SUPPORTED_MIMES.has(file.type)) {
    throw new Error("errors.image.unsupportedFormat");
  }

  if (file.type === "image/svg+xml") {
    const raw = await file.text();
    // DOMPurify's SVG profile requires the root <svg> to declare its
    // namespace; without `xmlns="http://www.w3.org/2000/svg"` the
    // parser treats the children as foreign HTML and strips shape
    // elements like <circle>. SVG editors usually set this attribute
    // but hand-written / minimal SVGs don't, so inject it when
    // missing before sanitising.
    const preStripped = preStripDangerousBlocks(raw);
    const withNamespace = ensureSvgNamespace(preStripped);
    const safe = DOMPurify.sanitize(withNamespace, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    return { src: `data:image/svg+xml;utf8,${encodeURIComponent(safe)}` };
  }

  const buffer = await file.arrayBuffer();
  const b64 = bytesToBase64(new Uint8Array(buffer));
  return { src: `data:${file.type};base64,${b64}` };
}
