/**
 * Server-side custom shape schemas for the sync TLSocketRoom.
 *
 * The client registers shape utils through `<Tldraw shapeUtils>` and
 * `useSync({ shapeUtils })`, but the server's TLSocketRoom needs the
 * same shape props validators so it accepts inbound mutations and
 * persists snapshots without ValidationError.
 *
 * These schemas MUST stay in lock-step with `apps/web/src/canvas/shapes/
 * shape-utils.tsx`. If you change a shape's props on the client, mirror
 * it here. Keeping the props as a flat record of validators keeps the
 * sync (zero-React) and is enforced by `apps/api/src/sync/shape-
 * schemas.test.ts`.
 *
 * Spec: canvas-shapes — "Canvas exposes four custom shape types".
 */

import { createTLSchema, defaultShapeSchemas } from "@tldraw/tlschema";
import { T } from "@tldraw/validate";

const SUPPORTED_LANGUAGES = [
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

const markdownShapeSchema = {
  props: {
    content: T.string,
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
  },
};

const codeShapeSchema = {
  props: {
    source: T.string,
    language: T.literalEnum(...SUPPORTED_LANGUAGES),
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
  },
};

const calloutShapeSchema = {
  props: {
    variant: T.literalEnum("info", "warning", "danger"),
    body: T.string,
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
  },
};

const linkCardShapeSchema = {
  props: {
    url: T.string,
    state: T.literalEnum("pending", "success", "error"),
    metadata: T.jsonValue.nullable(),
    fetchedAt: T.string.nullable(),
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
  },
};

export const vellumStoreSchema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    markdown: markdownShapeSchema,
    code: codeShapeSchema,
    callout: calloutShapeSchema,
    "link-card": linkCardShapeSchema,
  },
});
