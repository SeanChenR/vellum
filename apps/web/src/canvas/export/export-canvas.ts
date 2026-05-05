/**
 * export-canvas — pure-ish client-side export pipeline for the canvas.
 *
 * Spec: canvas-export
 *   - 4 formats (PNG / SVG / PDF / JSON)
 *   - Range follows current selection (fallback: entire current page)
 *   - PNG / PDF accept scale 1× / 2× / 4× (mapped to tldraw `pixelRatio`)
 *   - Filename = `{slug}.{ext}` — slug is supplied by the caller
 *   - PDF = jsPDF with embedded PNG (raster, not vector — see ADR / design.md)
 *   - No network calls — all transforms happen in the browser
 *
 * The function takes an `editor`-shaped object and two optional injection
 * points (`triggerDownload`, `pdfFromPng`) so that unit tests don't need
 * to touch the DOM or the real jsPDF runtime.
 */

import { jsPDF } from "jspdf";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ExportFormat = "png" | "svg" | "pdf" | "json";
export type ExportScale = 1 | 2 | 4;

/**
 * Subset of the tldraw `Editor` surface used by the export pipeline. Defining
 * it here lets callers pass real tldraw editors at runtime while tests can
 * supply minimal doubles.
 */
export interface ExportEditor {
  getSelectedShapeIds(): readonly string[];
  getCurrentPageShapeIds(): ReadonlySet<string>;
  toImage(
    shapes: readonly string[],
    opts?: { format?: string; pixelRatio?: number },
  ): Promise<{ blob: Blob; width: number; height: number }>;
  getSnapshot(): unknown;
}

export interface ExportOptions {
  editor: ExportEditor;
  format: ExportFormat;
  /** 1 | 2 | 4 — only meaningful for PNG / PDF. Defaults to 2. */
  scale?: ExportScale;
  /** Filename stem (already slugified, no extension). */
  filename: string;
  /** Test seam — defaults to anchor-based browser download. */
  triggerDownload?: (blob: Blob, filename: string) => void;
  /** Test seam — defaults to real jsPDF embedding the PNG. */
  pdfFromPng?: (pngBlob: Blob, width: number, height: number) => Promise<Blob>;
}

export class ExportError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ExportError";
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function exportCanvas(opts: ExportOptions): Promise<void> {
  const {
    editor,
    format,
    scale = 2,
    filename,
    triggerDownload = defaultTriggerDownload,
    pdfFromPng = defaultPdfFromPng,
  } = opts;

  const shapeIds = resolveShapeIds(editor);

  switch (format) {
    case "png": {
      const { blob } = await editor.toImage(shapeIds, { format: "png", pixelRatio: scale });
      assertNonEmpty(blob);
      triggerDownload(blob, `${filename}.png`);
      return;
    }
    case "svg": {
      const { blob } = await editor.toImage(shapeIds, { format: "svg" });
      assertNonEmpty(blob);
      triggerDownload(blob, `${filename}.svg`);
      return;
    }
    case "pdf": {
      const {
        blob: png,
        width,
        height,
      } = await editor.toImage(shapeIds, {
        format: "png",
        pixelRatio: scale,
      });
      assertNonEmpty(png);
      const pdf = await pdfFromPng(png, width, height);
      triggerDownload(pdf, `${filename}.pdf`);
      return;
    }
    case "json": {
      const snapshot = editor.getSnapshot();
      const blob = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
      triggerDownload(blob, `${filename}.json`);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveShapeIds(editor: ExportEditor): string[] {
  const selected = editor.getSelectedShapeIds();
  if (selected.length > 0) return [...selected];
  return Array.from(editor.getCurrentPageShapeIds());
}

function assertNonEmpty(blob: Blob): void {
  if (blob.size === 0) {
    throw new ExportError("export.empty");
  }
}

async function defaultPdfFromPng(png: Blob, width: number, height: number): Promise<Blob> {
  const dataUrl = await blobToDataUrl(png);
  const orientation = width >= height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  return pdf.output("blob");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new ExportError("export.dataUrl"));
        return;
      }
      resolve(result);
    });
    reader.addEventListener("error", () => reject(new ExportError("export.dataUrl", reader.error)));
    reader.readAsDataURL(blob);
  });
}

function defaultTriggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
