/**
 * asset-inline tests — Phase 1 client-side image upload encoder.
 *
 * Spec: multiplayer-sync — "Tldraw asset store inlines image uploads as
 * same-origin data URLs" + "Asset store rejects oversize and
 * unsupported uploads with localized errors".
 *
 * Tested behaviour (pure helper, no tldraw editor needed):
 *  - 5 supported MIME types each round-trip to a `data:<mime>...` URL
 *  - SVG sanitisation strips <script> / inline event handlers /
 *    <foreignObject> per spec example table
 *  - 5 MB size cap throws `errors.image.tooLarge` BEFORE any expensive read
 *  - Unsupported MIME (PDF, HEIC) throws `errors.image.unsupportedFormat`
 */

import { describe, expect, mock, test } from "bun:test";
import { inlineImageAsset } from "./asset-inline";

// ---------------------------------------------------------------------------
// Helpers — build minimal Files for unit tests (no actual binary content
// matters for the helper's contract; we just need the right MIME, size,
// and either text() or arrayBuffer() to resolve).
// ---------------------------------------------------------------------------

function makeFile(opts: { type: string; size: number; text?: string; bytes?: Uint8Array }): File {
  const bytes = opts.bytes ?? new Uint8Array(opts.size);
  // Backfill text so SVG path can read it; tests that need a specific
  // SVG body should pass `text` explicitly.
  const text = opts.text ?? new TextDecoder().decode(bytes);
  // Cast: Uint8Array typing cross-realm has a known TS bleed re. ArrayBufferLike;
  // File constructor accepts it at runtime.
  const file = new File([bytes as BlobPart], "test", { type: opts.type });
  // jsdom-style File doesn't always implement text()/arrayBuffer() the
  // same way; happy-dom honours the constructor input. We override to
  // ensure deterministic content for tests that need text.
  Object.defineProperty(file, "text", {
    value: () => Promise.resolve(text),
    configurable: true,
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(bytes.buffer.slice(0)),
    configurable: true,
  });
  Object.defineProperty(file, "size", {
    value: opts.size,
    configurable: true,
  });
  return file;
}

// ---------------------------------------------------------------------------
// Supported MIME types
// ---------------------------------------------------------------------------

describe("inlineImageAsset — supported binary MIME types", () => {
  const cases: Array<{ mime: string; prefix: string }> = [
    { mime: "image/png", prefix: "data:image/png;base64," },
    { mime: "image/jpeg", prefix: "data:image/jpeg;base64," },
    { mime: "image/gif", prefix: "data:image/gif;base64," },
    { mime: "image/webp", prefix: "data:image/webp;base64," },
  ];
  for (const c of cases) {
    test(`${c.mime} → ${c.prefix}<base64>`, async () => {
      const file = makeFile({
        type: c.mime,
        size: 4,
        bytes: new Uint8Array([1, 2, 3, 4]),
      });
      const result = await inlineImageAsset(file);
      expect(result.src.startsWith(c.prefix)).toBe(true);
      // base64 of 4-byte payload is 8 chars (with padding) at most;
      // assert the encoded portion is non-empty.
      const b64 = result.src.slice(c.prefix.length);
      expect(b64.length).toBeGreaterThan(0);
    });
  }
});

describe("inlineImageAsset — SVG path", () => {
  test("svg+xml round-trips to data:image/svg+xml;utf8,...", async () => {
    const svg = `<svg><circle r="5"/></svg>`;
    const file = makeFile({ type: "image/svg+xml", size: svg.length, text: svg });
    const result = await inlineImageAsset(file);
    expect(result.src.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const decoded = decodeURIComponent(result.src.slice("data:image/svg+xml;utf8,".length));
    expect(decoded).toContain("<circle");
  });

  // Spec example table — keep these inputs exactly as the spec says.
  test("svg sanitisation: strips <script>", async () => {
    const svg = `<svg><script>x()</script><circle r="5"/></svg>`;
    const file = makeFile({ type: "image/svg+xml", size: svg.length, text: svg });
    const result = await inlineImageAsset(file);
    const decoded = decodeURIComponent(result.src.slice("data:image/svg+xml;utf8,".length));
    expect(decoded.toLowerCase()).not.toContain("<script");
    expect(decoded).toContain("<circle");
  });

  test("svg sanitisation: strips inline event handler", async () => {
    const svg = `<svg><image onclick="x()" href="a.png"/></svg>`;
    const file = makeFile({ type: "image/svg+xml", size: svg.length, text: svg });
    const result = await inlineImageAsset(file);
    const decoded = decodeURIComponent(result.src.slice("data:image/svg+xml;utf8,".length));
    expect(decoded.toLowerCase()).not.toContain("onclick");
  });

  test("svg sanitisation: strips <foreignObject>", async () => {
    const svg = `<svg><foreignObject><iframe/></foreignObject></svg>`;
    const file = makeFile({ type: "image/svg+xml", size: svg.length, text: svg });
    const result = await inlineImageAsset(file);
    const decoded = decodeURIComponent(result.src.slice("data:image/svg+xml;utf8,".length));
    expect(decoded.toLowerCase()).not.toContain("<iframe");
  });
});

// ---------------------------------------------------------------------------
// Size cap
// ---------------------------------------------------------------------------

describe("inlineImageAsset — size cap", () => {
  test("6 MB PNG throws errors.image.tooLarge", async () => {
    const file = makeFile({ type: "image/png", size: 6 * 1024 * 1024 });
    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.tooLarge");
  });

  test("size check happens BEFORE arrayBuffer/text — no expensive read on rejection", async () => {
    const arrayBufferSpy = mock(() => Promise.resolve(new ArrayBuffer(0)));
    const textSpy = mock(() => Promise.resolve(""));
    const file = makeFile({ type: "image/png", size: 6 * 1024 * 1024 });
    Object.defineProperty(file, "arrayBuffer", { value: arrayBufferSpy, configurable: true });
    Object.defineProperty(file, "text", { value: textSpy, configurable: true });

    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.tooLarge");
    expect(arrayBufferSpy).not.toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
  });

  test("exactly 5 MB is accepted (≤ cap, not <)", async () => {
    const file = makeFile({
      type: "image/png",
      size: 5 * 1024 * 1024,
      bytes: new Uint8Array(5 * 1024 * 1024),
    });
    const result = await inlineImageAsset(file);
    expect(result.src.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("5 MB + 1 byte is rejected (strict greater than)", async () => {
    const file = makeFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 });
    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.tooLarge");
  });
});

// ---------------------------------------------------------------------------
// Unsupported MIME
// ---------------------------------------------------------------------------

describe("inlineImageAsset — unsupported MIME", () => {
  test("application/pdf throws errors.image.unsupportedFormat", async () => {
    const file = makeFile({ type: "application/pdf", size: 100 });
    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.unsupportedFormat");
  });

  test("image/heic throws errors.image.unsupportedFormat (Phase 1 out-of-scope)", async () => {
    const file = makeFile({ type: "image/heic", size: 100 });
    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.unsupportedFormat");
  });

  test("image/tiff throws errors.image.unsupportedFormat", async () => {
    const file = makeFile({ type: "image/tiff", size: 100 });
    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.unsupportedFormat");
  });

  test("empty MIME (browser couldn't infer) throws errors.image.unsupportedFormat", async () => {
    const file = makeFile({ type: "", size: 100 });
    await expect(inlineImageAsset(file)).rejects.toThrow("errors.image.unsupportedFormat");
  });
});
