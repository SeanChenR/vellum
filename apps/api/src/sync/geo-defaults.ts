/**
 * geo-defaults.ts — fill tldraw's `geo` shape required props at the
 * agent boundary.
 *
 * The agent tool surface intentionally exposes a small slice of geo
 * props (geo variant, color, fill, dash, size, text, w, h). tldraw's
 * record validator (`geoShapeProps`) however demands a full prop set:
 * align, verticalAlign, font, labelColor, url, growY, scale, richText.
 * Without these, `store.put()` rejects the record at sync time and the
 * mutator surfaces a generic `mutationFailed`, which is opaque to both
 * the agent and the user.
 *
 * Two helpers:
 *   - `withGeoCreateDefaults`: create-side. Merges user-supplied props
 *     over the full default set and converts plain `text` to richText.
 *   - `transformGeoPartialProps`: update-side. Only translates
 *     `text` → `richText`; never injects defaults that would clobber
 *     fields the existing record already has.
 */

import { toRichText } from "@tldraw/tlschema";

const GEO_CREATE_DEFAULTS = {
  geo: "rectangle",
  color: "black",
  fill: "none",
  dash: "draw",
  size: "m",
  font: "draw",
  align: "middle",
  verticalAlign: "middle",
  labelColor: "black",
  url: "",
  growY: 0,
  scale: 1,
  w: 200,
  h: 200,
} as const;

function extractText(input: Record<string, unknown>): {
  text: string | null;
  rest: Record<string, unknown>;
} {
  if (!("text" in input)) return { text: null, rest: input };
  const { text, ...rest } = input;
  return {
    text: typeof text === "string" ? text : "",
    rest,
  };
}

export function withGeoCreateDefaults(userProps: Record<string, unknown>): Record<string, unknown> {
  const { text, rest } = extractText(userProps);
  return {
    ...GEO_CREATE_DEFAULTS,
    ...rest,
    richText: toRichText(text ?? ""),
  };
}

export function transformGeoPartialProps(
  partialProps: Record<string, unknown>,
): Record<string, unknown> {
  const { text, rest } = extractText(partialProps);
  if (text === null) return rest;
  return {
    ...rest,
    richText: toRichText(text),
  };
}
