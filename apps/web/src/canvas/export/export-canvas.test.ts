/**
 * export-canvas tests — covers tasks 3.1 / 3.2 / 3.3 / 3.5 of add-export.
 *
 * Spec: canvas-export
 *   - "Editor and owner can export the canvas in four formats"
 *   - "Export range follows current selection"
 *   - "Export pipeline runs entirely in the browser"
 *
 * The function `exportCanvas` is contract-tested against a fake tldraw
 * editor double. We never touch real jsPDF here — the PDF maker is
 * dependency-injected, so tests assert on the inputs/outputs of the
 * pipeline rather than the bytes jsPDF produces.
 */

import { describe, expect, test } from "bun:test";
import { exportCanvas, type ExportFormat } from "./export-canvas";

// ---------------------------------------------------------------------------
// Fake editor
// ---------------------------------------------------------------------------

interface ToImageCall {
  shapes: readonly string[];
  opts: { format?: string; pixelRatio?: number; scale?: number } | undefined;
}

function makeFakeEditor(
  over: {
    selected?: string[];
    pageShapes?: string[];
    toImage?: { blob: Blob; width: number; height: number };
    snapshot?: unknown;
  } = {},
) {
  const calls: ToImageCall[] = [];
  const editor = {
    getSelectedShapeIds: () => over.selected ?? [],
    getCurrentPageShapeIds: () => new Set(over.pageShapes ?? ["s1", "s2"]),
    toImage: async (shapes: string[], opts?: ToImageCall["opts"]) => {
      calls.push({ shapes: [...shapes], opts });
      return (
        over.toImage ?? {
          blob: new Blob(["fake-bytes"], { type: "image/png" }),
          width: 800,
          height: 600,
        }
      );
    },
    getSnapshot: () => over.snapshot ?? { document: { x: 1 }, session: null },
  };
  return { editor, calls };
}

// ---------------------------------------------------------------------------
// Captured download / PDF deps
// ---------------------------------------------------------------------------

function makeCaptures() {
  const downloads: Array<{ blob: Blob; filename: string }> = [];
  const pdfCalls: Array<{ pngSize: number; width: number; height: number }> = [];
  return {
    downloads,
    pdfCalls,
    triggerDownload: (blob: Blob, filename: string) => {
      downloads.push({ blob, filename });
    },
    pdfFromPng: async (png: Blob, width: number, height: number) => {
      pdfCalls.push({ pngSize: png.size, width, height });
      return new Blob(["%PDF-fake%"], { type: "application/pdf" });
    },
  };
}

// ---------------------------------------------------------------------------
// Browser-only invariant — the public exportCanvas API never receives a fetch
// reference and the deps (editor.toImage / pdfFromPng / triggerDownload) all
// route to local Blobs. We assert that scoped per-call (see "runs entirely
// in the browser" suite) by spying on `globalThis.fetch` *inside* each test
// and restoring it before the test ends, so happy-dom's internal fetch
// usage in other parallel test files is untouched.
// ---------------------------------------------------------------------------

async function withFetchSpy<T>(run: (calls: { count: number }) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const counter = { count: 0 };
  globalThis.fetch = (async () => {
    counter.count += 1;
    throw new Error("fetch should not be called by exportCanvas");
  }) as unknown as typeof globalThis.fetch;
  try {
    return await run(counter);
  } finally {
    globalThis.fetch = orig;
  }
}

// ---------------------------------------------------------------------------
// 3.1 Format dispatch + filename
// ---------------------------------------------------------------------------

describe("exportCanvas — format dispatch", () => {
  test("PNG calls toImage with format=png + pixelRatio=scale and downloads .png", async () => {
    const { editor, calls } = makeFakeEditor({ pageShapes: ["a", "b"] });
    const cap = makeCaptures();

    await exportCanvas({
      editor: editor as never,
      format: "png",
      scale: 2,
      filename: "my-doc",
      ...cap,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.opts?.format).toBe("png");
    expect(calls[0]!.opts?.pixelRatio).toBe(2);
    expect(cap.downloads).toHaveLength(1);
    expect(cap.downloads[0]!.filename).toBe("my-doc.png");
    expect(cap.downloads[0]!.blob.size).toBeGreaterThan(0);
  });

  test("SVG calls toImage with format=svg, no pixelRatio, downloads .svg", async () => {
    const { editor, calls } = makeFakeEditor();
    const cap = makeCaptures();

    await exportCanvas({
      editor: editor as never,
      format: "svg",
      filename: "vec",
      ...cap,
    });

    expect(calls[0]!.opts?.format).toBe("svg");
    expect(calls[0]!.opts?.pixelRatio).toBeUndefined();
    expect(cap.downloads[0]!.filename).toBe("vec.svg");
  });

  test("PDF calls toImage with format=png, then pdfFromPng, then downloads .pdf", async () => {
    const { editor, calls } = makeFakeEditor({
      toImage: {
        blob: new Blob(["x".repeat(100)], { type: "image/png" }),
        width: 1024,
        height: 768,
      },
    });
    const cap = makeCaptures();

    await exportCanvas({
      editor: editor as never,
      format: "pdf",
      scale: 4,
      filename: "report",
      ...cap,
    });

    expect(calls[0]!.opts?.format).toBe("png");
    expect(calls[0]!.opts?.pixelRatio).toBe(4);
    expect(cap.pdfCalls).toEqual([{ pngSize: 100, width: 1024, height: 768 }]);
    expect(cap.downloads[0]!.filename).toBe("report.pdf");
    expect(cap.downloads[0]!.blob.type).toBe("application/pdf");
  });

  test("JSON serializes editor.getSnapshot() and downloads .json", async () => {
    const snap = { document: { records: 7 } };
    const { editor, calls } = makeFakeEditor({ snapshot: snap });
    const cap = makeCaptures();

    await exportCanvas({
      editor: editor as never,
      format: "json",
      filename: "snap",
      ...cap,
    });

    expect(calls).toHaveLength(0); // toImage NOT called
    expect(cap.downloads).toHaveLength(1);
    expect(cap.downloads[0]!.filename).toBe("snap.json");
    const text = await cap.downloads[0]!.blob.text();
    expect(JSON.parse(text)).toEqual(snap);
    expect(cap.downloads[0]!.blob.type).toContain("application/json");
  });

  test("PNG defaults to scale=2 when not provided", async () => {
    const { editor, calls } = makeFakeEditor();
    const cap = makeCaptures();
    await exportCanvas({ editor: editor as never, format: "png", filename: "x", ...cap });
    expect(calls[0]!.opts?.pixelRatio).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3.2 Selection drives range
// ---------------------------------------------------------------------------

describe("exportCanvas — range follows selection", () => {
  test("selection non-empty: passes selectedShapeIds to toImage", async () => {
    const { editor, calls } = makeFakeEditor({
      selected: ["sel-1", "sel-2"],
      pageShapes: ["sel-1", "sel-2", "other-3"],
    });
    const cap = makeCaptures();

    await exportCanvas({ editor: editor as never, format: "png", filename: "x", ...cap });

    expect(calls[0]!.shapes).toEqual(["sel-1", "sel-2"]);
  });

  test("no selection: passes all current-page shape ids", async () => {
    const { editor, calls } = makeFakeEditor({
      selected: [],
      pageShapes: ["a", "b", "c"],
    });
    const cap = makeCaptures();

    await exportCanvas({ editor: editor as never, format: "svg", filename: "x", ...cap });

    expect([...calls[0]!.shapes].sort()).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// 3.3 No network activity
// ---------------------------------------------------------------------------

describe("exportCanvas — runs entirely in the browser", () => {
  const formats: ExportFormat[] = ["png", "svg", "pdf", "json"];
  test.each(formats)("%s never invokes global.fetch", async (format) => {
    await withFetchSpy(async (counter) => {
      const { editor } = makeFakeEditor();
      const cap = makeCaptures();
      await exportCanvas({ editor: editor as never, format, filename: "x", scale: 1, ...cap });
      expect(counter.count).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 3.5 Empty / failure handling
// ---------------------------------------------------------------------------

describe("exportCanvas — failure modes", () => {
  test("PNG with empty Blob throws", async () => {
    const { editor } = makeFakeEditor({
      toImage: { blob: new Blob([], { type: "image/png" }), width: 0, height: 0 },
    });
    const cap = makeCaptures();

    await expect(
      exportCanvas({ editor: editor as never, format: "png", filename: "x", ...cap }),
    ).rejects.toThrow();
    expect(cap.downloads).toHaveLength(0);
  });

  test("PDF with empty PNG Blob throws before invoking pdfFromPng", async () => {
    const { editor } = makeFakeEditor({
      toImage: { blob: new Blob([], { type: "image/png" }), width: 0, height: 0 },
    });
    const cap = makeCaptures();

    await expect(
      exportCanvas({ editor: editor as never, format: "pdf", scale: 2, filename: "x", ...cap }),
    ).rejects.toThrow();
    expect(cap.pdfCalls).toHaveLength(0);
    expect(cap.downloads).toHaveLength(0);
  });

  test("toImage rejection propagates and no download fires", async () => {
    const failingEditor = {
      getSelectedShapeIds: () => [],
      getCurrentPageShapeIds: () => new Set(["a"]),
      toImage: () => Promise.reject(new Error("boom")),
      getSnapshot: () => ({}),
    };
    const cap = makeCaptures();

    await expect(
      exportCanvas({ editor: failingEditor as never, format: "svg", filename: "x", ...cap }),
    ).rejects.toThrow("boom");
    expect(cap.downloads).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Default DI seams — exercise real `defaultTriggerDownload` and
// `defaultPdfFromPng` paths in happy-dom so the coverage on the bundled
// runtime stays above the 70 % target. The deeper tests above use the
// inject-able seams; these two ensure the defaults themselves work.
// ---------------------------------------------------------------------------

describe("exportCanvas — default DI seams (smoke)", () => {
  test("default triggerDownload creates an anchor + clicks + cleans up", async () => {
    let clicked = false;
    let appendedHref: string | null = null;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const created: string[] = [];
    const revoked: string[] = [];
    URL.createObjectURL = ((blob: Blob) => {
      const u = `blob:test/${created.length}-${blob.size}`;
      created.push(u);
      return u;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((u: string) => {
      revoked.push(u);
    }) as typeof URL.revokeObjectURL;

    const origCreateElement = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        el.click = () => {
          clicked = true;
          appendedHref = (el as HTMLAnchorElement).href;
        };
      }
      return el;
    }) as typeof document.createElement;

    try {
      const { editor } = makeFakeEditor();
      // Use a real (non-injected) triggerDownload by calling JSON path
      // (no PDF, no special seam) — JSON exercises the default path
      // because we don't pass triggerDownload here.
      await exportCanvas({
        editor: editor as never,
        format: "json",
        filename: "smoke",
      });
      expect(clicked).toBe(true);
      expect(appendedHref).toMatch(/^blob:test\//);
      expect(created).toHaveLength(1);
      expect(revoked).toEqual(created);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      document.createElement = origCreateElement as typeof document.createElement;
    }
  });

  test("default pdfFromPng accepts a PNG Blob and produces a PDF Blob via jsPDF", async () => {
    // 1x1 transparent PNG — known-valid bytes so jsPDF's PNG decoder doesn't bail.
    const base64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const png = new Blob([binary], { type: "image/png" });

    const { editor } = makeFakeEditor({
      toImage: { blob: png, width: 1, height: 1 },
    });
    const downloads: Array<{ blob: Blob; filename: string }> = [];

    await exportCanvas({
      editor: editor as never,
      format: "pdf",
      scale: 1,
      filename: "smoke",
      triggerDownload: (blob, filename) => downloads.push({ blob, filename }),
      // intentionally NOT injecting pdfFromPng — exercises the real jsPDF path
    });

    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.filename).toBe("smoke.pdf");
    expect(downloads[0]!.blob.size).toBeGreaterThan(0);
    expect(downloads[0]!.blob.type).toContain("application/pdf");
  });
});
