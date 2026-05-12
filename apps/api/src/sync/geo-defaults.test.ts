/**
 * geo-defaults.test.ts — coverage for the tldraw geo shape prop helpers.
 *
 * The agent surface accepts a slim subset of geo props (geo variant,
 * color, fill, dash, size, text, w, h). These helpers fill the rest of
 * the tldraw-required props with sensible defaults on create, and on
 * update they only translate `text` → `richText` without clobbering
 * existing fields. This keeps the LLM-facing shape minimal while still
 * producing records that pass tldraw's validators.
 */

import { describe, expect, test } from "bun:test";
import { transformGeoPartialProps, withGeoCreateDefaults } from "./geo-defaults";

describe("withGeoCreateDefaults", () => {
  test("supplies every tldraw-required geo prop when given an empty object", () => {
    const props = withGeoCreateDefaults({});
    expect(props.geo).toBe("rectangle");
    expect(props.color).toBe("black");
    expect(props.fill).toBe("none");
    expect(props.dash).toBe("draw");
    expect(props.size).toBe("m");
    expect(props.font).toBe("draw");
    expect(props.align).toBe("middle");
    expect(props.verticalAlign).toBe("middle");
    expect(props.labelColor).toBe("black");
    expect(props.url).toBe("");
    expect(props.growY).toBe(0);
    expect(props.scale).toBe(1);
    expect(props.w).toBeGreaterThan(0);
    expect(props.h).toBeGreaterThan(0);
    expect(props.richText).toMatchObject({ type: "doc" });
  });

  test("user-supplied props override the defaults", () => {
    const props = withGeoCreateDefaults({
      geo: "ellipse",
      color: "red",
      fill: "solid",
      w: 320,
      h: 180,
    });
    expect(props.geo).toBe("ellipse");
    expect(props.color).toBe("red");
    expect(props.fill).toBe("solid");
    expect(props.w).toBe(320);
    expect(props.h).toBe(180);
  });

  test("translates `text` into richText and strips the text key", () => {
    const props = withGeoCreateDefaults({ text: "Hello" });
    expect(props).not.toHaveProperty("text");
    expect(props.richText).toMatchObject({ type: "doc" });
    expect(JSON.stringify(props.richText)).toContain("Hello");
  });

  test("missing text still produces a valid empty richText", () => {
    const props = withGeoCreateDefaults({});
    expect(props.richText).toMatchObject({ type: "doc" });
  });
});

describe("transformGeoPartialProps", () => {
  test("returns an empty object when nothing is passed", () => {
    expect(transformGeoPartialProps({})).toEqual({});
  });

  test("passes through props that are not text", () => {
    expect(transformGeoPartialProps({ color: "blue", w: 120 })).toEqual({
      color: "blue",
      w: 120,
    });
  });

  test("converts text to richText and drops the text key", () => {
    const out = transformGeoPartialProps({ text: "updated" });
    expect(out).not.toHaveProperty("text");
    expect(out.richText).toMatchObject({ type: "doc" });
    expect(JSON.stringify(out.richText)).toContain("updated");
  });

  test("does NOT inject defaults for missing keys", () => {
    const out = transformGeoPartialProps({ color: "violet" });
    expect(out).not.toHaveProperty("geo");
    expect(out).not.toHaveProperty("fill");
    expect(out).not.toHaveProperty("richText");
  });
});
