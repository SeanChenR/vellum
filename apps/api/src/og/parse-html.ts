/**
 * parse-html — pure HTML → OG metadata extractor.
 *
 * Uses regex to extract `<meta>` and `<link rel="icon">` tags rather than
 * a full HTML parser; OG metadata is conventionally in `<head>` and
 * regex handles the long-tail of malformed HTML in the wild without
 * blowing up. Intentionally never throws — a malformed page yields an
 * empty object, not an exception.
 *
 * Spec: canvas-shapes — "OG metadata endpoint returns sanitized parsed
 * result with two-tier cache" (parser portion).
 */

export interface OgMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

const META_RE = /<meta\b[^>]*>/gi;
const LINK_RE = /<link\b[^>]*>/gi;
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const ATTR_RE = /(\w[\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(tag))) {
    const name = m[1]?.toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (name) out[name] = value;
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim();
}

export function parseHtmlForOg(html: string): OgMetadata {
  if (typeof html !== "string" || html.length === 0) return {};

  const result: OgMetadata = {};

  try {
    // 1. <meta> tags — collect og:* + standard description
    const metas = html.match(META_RE) ?? [];
    for (const tag of metas) {
      const a = attrs(tag);
      const propKey = (a.property ?? a.name ?? "").toLowerCase();
      const content = a.content;
      if (!content) continue;
      switch (propKey) {
        case "og:title":
          result.title = decodeEntities(content);
          break;
        case "og:description":
          result.description = decodeEntities(content);
          break;
        case "og:image":
          result.image = decodeEntities(content);
          break;
        case "og:site_name":
          result.siteName = decodeEntities(content);
          break;
      }
    }

    // 2. <title> as fallback when og:title missing
    if (!result.title) {
      const m = html.match(TITLE_RE);
      const t = m?.[1]?.trim();
      if (t) result.title = decodeEntities(t);
    }

    // 3. <link rel="icon"> — first match wins
    const links = html.match(LINK_RE) ?? [];
    for (const tag of links) {
      const a = attrs(tag);
      const rel = (a.rel ?? "").toLowerCase();
      if (rel.split(/\s+/).includes("icon") && a.href) {
        result.favicon = decodeEntities(a.href);
        break;
      }
    }
  } catch {
    return {};
  }

  return result;
}
