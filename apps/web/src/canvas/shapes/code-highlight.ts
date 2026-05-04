/**
 * code-highlight — Shiki-backed syntax highlighting for the Code shape.
 *
 * Uses a singleton highlighter that lazy-loads each language grammar on
 * first use, so the main bundle pays only for what the user actually
 * inserts. Theme is fixed to `github-light` for M6; dark mode is M8.
 *
 * Spec: canvas-shapes — "Code shape highlights via lazy-loaded Shiki".
 */

import { createHighlighter, type BundledLanguage, type Highlighter, type ThemedToken } from "shiki";

export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "go",
  "swift",
  "rust",
  "html",
  "css",
  "sql",
  "bash",
  "markdown",
  "json",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const THEME = "github-light";

export interface HighlightToken {
  content: string;
  color?: string;
}

export interface HighlightResult {
  tokens: HighlightToken[][];
  /** i18n key when fallback to plain text is used; null on success. */
  error: string | null;
}

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [],
    });
  }
  return highlighterPromise;
}

function plainTextResult(source: string, error: string | null): HighlightResult {
  return {
    tokens: [[{ content: source }]],
    error,
  };
}

function isSupported(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Highlight `source` for the given language. Unknown languages fall back
 * to plain text with `error: "errors.shape.code.unknownLanguage"`. Never
 * throws; callers can rely on a defined `HighlightResult`.
 */
export async function highlightCode(source: string, lang: string): Promise<HighlightResult> {
  if (!isSupported(lang)) {
    return plainTextResult(source, "errors.shape.code.unknownLanguage");
  }

  let highlighter: Highlighter;
  try {
    highlighter = await getHighlighter();
  } catch {
    return plainTextResult(source, "errors.shape.code.unknownLanguage");
  }

  if (!loadedLangs.has(lang)) {
    try {
      await highlighter.loadLanguage(lang as BundledLanguage);
      loadedLangs.add(lang);
    } catch {
      return plainTextResult(source, "errors.shape.code.unknownLanguage");
    }
  }

  let raw: { tokens: ThemedToken[][] };
  try {
    raw = highlighter.codeToTokens(source, { lang, theme: THEME });
  } catch {
    return plainTextResult(source, "errors.shape.code.unknownLanguage");
  }

  const tokens: HighlightToken[][] = raw.tokens.map((row) =>
    row.map((t) => ({ content: t.content, color: t.color })),
  );
  return { tokens, error: null };
}
