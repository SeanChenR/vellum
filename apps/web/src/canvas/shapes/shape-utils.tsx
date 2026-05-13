/**
 * shape-utils — tldraw ShapeUtil class definitions for the four custom
 * shapes (Markdown, Code, Callout, Link card).
 *
 * Each ShapeUtil:
 *  - Declares its props schema (validated by tldraw store on hydrate).
 *  - Provides a default size + content via `getDefaultProps`.
 *  - Renders the shape via the matching view component, plumbing in the
 *    edit-lock state derived from tldraw's collaborator presence.
 *  - Reports `canResize: true`, `canEdit: true` so the user can resize
 *    and enter editing mode.
 *
 * Note on tldraw types: `ShapeUtil<Shape>` constrains `Shape extends TLShape`
 * which only includes built-in shape types. We extend `ShapeUtil` and treat
 * the constraint as compatible at runtime — tldraw's actual usage relies
 * only on `id`, `type`, and `props.{w,h}` which our shapes provide.
 *
 * Spec: canvas-shapes — "Canvas exposes four custom shape types".
 */

// biome-ignore lint/style/useImportType: tldraw runtime + type imports interleaved
import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  resizeBox,
  useEditor,
  useValue,
  type Geometry2d,
  type RecordProps,
  type TLBaseShape,
  type TLResizeInfo,
  type TLShapeId,
} from "tldraw";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CalloutShapeView, CalloutVariantPicker, type CalloutVariant } from "./callout-shape";
import { CodeShapeView } from "./code-shape";
import { LinkCardShapeView } from "./link-card-shape";
import { MarkdownEditDialog, MarkdownShapeView } from "./markdown-shape";
import {
  isStale,
  nextLinkCardState,
  type LinkCardMetadata,
  type LinkCardState,
  type LinkCardStored,
} from "./link-card-state";
import { useShapeEditLock, type ShapePresence } from "./use-shape-edit-lock";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./code-highlight";

// ---------------------------------------------------------------------------
// Module augmentation — register our four shape types with tldraw's type
// system via TLGlobalShapePropsMap (the documented extension point).
// ---------------------------------------------------------------------------

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    markdown: { content: string; w: number; h: number };
    code: { source: string; language: SupportedLanguage; w: number; h: number };
    callout: { variant: CalloutVariant; body: string; w: number; h: number };
    "link-card": {
      url: string;
      state: LinkCardState;
      metadata: LinkCardMetadata | null;
      fetchedAt: string | null;
      w: number;
      h: number;
    };
  }
}

// ---------------------------------------------------------------------------
// Lock plumbing — derive ShapePresence[] from tldraw collaborator presence
// ---------------------------------------------------------------------------

interface InstancePresenceLike {
  userId: string;
  userName: string;
  editingShapeId: TLShapeId | null;
  lastActivityTimestamp: number;
}

function useEditLockForShape(shapeId: TLShapeId) {
  const editor = useEditor();
  // M6 minimum: read presence reactively but DEFENSIVELY — return a
  // stable empty list when the editor has no presence query yet.
  // `useValue` requires its derive function to read reactive signals;
  // wrapping in try/catch keeps SSR / tests where collaborators() may
  // not exist from blowing up. We expose just the userId we need.
  const selfUserId = useValue(
    "shape-edit-lock:self",
    () => {
      try {
        return editor.user.getId();
      } catch {
        return "self";
      }
    },
    [editor],
  );

  // Phase-1: skip live presence subscription (an empty presence list
  // means no other user is editing — current user is never locked).
  // Multiplayer presence integration is tracked under M6 polish; lock
  // logic + view badge ship now so future wiring is one-line.
  const presences: ShapePresence[] = [];

  return useShapeEditLock({
    shapeId: String(shapeId),
    selfUserId,
    presences,
  });
}

// ---------------------------------------------------------------------------
// Shared helpers — geometry + resize for box-shaped shapes
// ---------------------------------------------------------------------------

interface BoxLike {
  props: { w: number; h: number };
}

function boxGeometry(shape: BoxLike): Geometry2d {
  return new Rectangle2d({
    width: shape.props.w,
    height: shape.props.h,
    isFilled: true,
  });
}

// ---------------------------------------------------------------------------
// Markdown shape
// ---------------------------------------------------------------------------

export type MarkdownShape = TLBaseShape<"markdown", { content: string; w: number; h: number }>;

const MARKDOWN_PROPS: RecordProps<MarkdownShape> = {
  content: T.string,
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
};

export class MarkdownShapeUtil extends ShapeUtil<MarkdownShape> {
  static override type = "markdown" as const;
  static override props = MARKDOWN_PROPS;

  override getDefaultProps(): MarkdownShape["props"] {
    return { content: "# New note\n\nStart typing…", w: 320, h: 200 };
  }
  override canEdit() {
    return true;
  }
  override canResize() {
    return true;
  }
  override getGeometry(shape: MarkdownShape) {
    return boxGeometry(shape);
  }
  override onResize(shape: MarkdownShape, info: TLResizeInfo<MarkdownShape>) {
    return resizeBox(shape, info);
  }
  override component(shape: MarkdownShape) {
    return <MarkdownShapeWrapper shape={shape} />;
  }
  override indicator(shape: MarkdownShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

function MarkdownShapeWrapper({ shape }: { shape: MarkdownShape }) {
  const editor = useEditor();
  const { canEdit, lockedBy } = useEditLockForShape(shape.id);
  // Tldraw drives "is this shape currently being edited?" via the
  // `editingShapeId` instance state — set when the user double-clicks
  // a shape whose util.canEdit() returns true. Reading it reactively
  // is the supported way to render an editor UI.
  const editing = useValue("markdown-editing", () => editor.getEditingShapeId() === shape.id, [
    editor,
    shape.id,
  ]);

  const handleSubmit = useCallback(
    (next: string) => {
      editor.updateShape({
        id: shape.id,
        type: "markdown",
        props: { ...shape.props, content: next },
      });
      editor.setEditingShape(null);
    },
    [editor, shape.id, shape.props],
  );

  const handleCancel = useCallback(() => {
    editor.setEditingShape(null);
  }, [editor]);

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: "all" }}>
      <MarkdownShapeView
        content={shape.props.content}
        locked={!canEdit}
        lockedBy={lockedBy}
        onRequestEdit={() => {
          if (!canEdit) return;
          editor.setEditingShape(shape.id);
        }}
      />
      <MarkdownEditDialog
        open={editing}
        initialContent={shape.props.content}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </HTMLContainer>
  );
}

// ---------------------------------------------------------------------------
// Code shape
// ---------------------------------------------------------------------------

const SUPPORTED_LANG_VALIDATOR = T.literalEnum(...SUPPORTED_LANGUAGES);

export type CodeShape = TLBaseShape<
  "code",
  { source: string; language: SupportedLanguage; w: number; h: number }
>;

const CODE_PROPS: RecordProps<CodeShape> = {
  source: T.string,
  language: SUPPORTED_LANG_VALIDATOR,
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
};

export class CodeShapeUtil extends ShapeUtil<CodeShape> {
  static override type = "code" as const;
  static override props = CODE_PROPS;

  override getDefaultProps(): CodeShape["props"] {
    return { source: "// write some code", language: "typescript", w: 360, h: 220 };
  }
  override canEdit() {
    return true;
  }
  override canResize() {
    return true;
  }
  override getGeometry(shape: CodeShape) {
    return boxGeometry(shape);
  }
  override onResize(shape: CodeShape, info: TLResizeInfo<CodeShape>) {
    const next = resizeBox(shape, info);
    return {
      ...next,
      props: {
        ...shape.props,
        ...next.props,
        w: Math.max(240, next.props?.w ?? shape.props.w),
        h: Math.max(120, next.props?.h ?? shape.props.h),
      },
    };
  }
  override component(shape: CodeShape) {
    return <CodeShapeWrapper shape={shape} />;
  }
  override indicator(shape: CodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

function CodeShapeWrapper({ shape }: { shape: CodeShape }) {
  const editor = useEditor();
  const { canEdit, lockedBy } = useEditLockForShape(shape.id);
  const editing = useValue("code-editing", () => editor.getEditingShapeId() === shape.id, [
    editor,
    shape.id,
  ]);

  const handleSubmit = useCallback(
    (next: string) => {
      editor.updateShape({
        id: shape.id,
        type: "code",
        props: { ...shape.props, source: next },
      });
      editor.setEditingShape(null);
    },
    [editor, shape.id, shape.props],
  );

  const handleCancel = useCallback(() => {
    editor.setEditingShape(null);
  }, [editor]);

  const handleLanguageChange = useCallback(
    (next: SupportedLanguage) => {
      editor.updateShape({
        id: shape.id,
        type: "code",
        props: { ...shape.props, language: next },
      });
    },
    [editor, shape.id, shape.props],
  );

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: "all" }}>
      <CodeShapeView
        source={shape.props.source}
        language={shape.props.language}
        locked={!canEdit}
        lockedBy={lockedBy}
        onRequestEdit={() => {
          if (!canEdit) return;
          editor.setEditingShape(shape.id);
        }}
      />
      <CodeEditDialogWrapper
        open={editing}
        initialContent={shape.props.source}
        language={shape.props.language}
        onLanguageChange={handleLanguageChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </HTMLContainer>
  );
}

function CodeLanguagePicker({
  value,
  onChange,
}: {
  value: SupportedLanguage;
  onChange: (next: SupportedLanguage) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-sm text-text-primary">
      <span>{t("shapes.code.languageSelectorLabel")}</span>
      <select
        aria-label={t("shapes.code.languageSelectorLabel")}
        value={value}
        onChange={(e) => onChange(e.target.value as SupportedLanguage)}
        className="rounded border border-border bg-bg px-2 py-1 text-sm text-text-primary"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {t(`shapes.code.languages.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CodeEditDialogWrapper(props: {
  open: boolean;
  initialContent: string;
  language: SupportedLanguage;
  onLanguageChange: (next: SupportedLanguage) => void;
  onSubmit: (next: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { language, onLanguageChange, ...rest } = props;
  return (
    <MarkdownEditDialog
      {...rest}
      title={t("shapes.code.editDialogTitle")}
      placeholder={t("shapes.code.editPlaceholder")}
      headerExtras={<CodeLanguagePicker value={language} onChange={onLanguageChange} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Callout shape
// ---------------------------------------------------------------------------

const VARIANT_VALIDATOR = T.literalEnum("info", "warning", "danger");

export type CalloutShape = TLBaseShape<
  "callout",
  { variant: CalloutVariant; body: string; w: number; h: number }
>;

const CALLOUT_PROPS: RecordProps<CalloutShape> = {
  variant: VARIANT_VALIDATOR,
  body: T.string,
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
};

export class CalloutShapeUtil extends ShapeUtil<CalloutShape> {
  static override type = "callout" as const;
  static override props = CALLOUT_PROPS;

  override getDefaultProps(): CalloutShape["props"] {
    return {
      variant: "info",
      body: "Write your callout content here",
      w: 320,
      h: 80,
    };
  }
  override canEdit() {
    return true;
  }
  override canResize() {
    return true;
  }
  override getGeometry(shape: CalloutShape) {
    return boxGeometry(shape);
  }
  override onResize(shape: CalloutShape, info: TLResizeInfo<CalloutShape>) {
    return resizeBox(shape, info);
  }
  override component(shape: CalloutShape) {
    return <CalloutShapeWrapper shape={shape} />;
  }
  override indicator(shape: CalloutShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

function CalloutShapeWrapper({ shape }: { shape: CalloutShape }) {
  const editor = useEditor();
  const { canEdit, lockedBy } = useEditLockForShape(shape.id);
  const editing = useValue("callout-editing", () => editor.getEditingShapeId() === shape.id, [
    editor,
    shape.id,
  ]);

  const handleSubmit = useCallback(
    (next: string) => {
      editor.updateShape({
        id: shape.id,
        type: "callout",
        props: { ...shape.props, body: next },
      });
      editor.setEditingShape(null);
    },
    [editor, shape.id, shape.props],
  );

  const handleCancel = useCallback(() => {
    editor.setEditingShape(null);
  }, [editor]);

  const handleVariantChange = useCallback(
    (next: CalloutVariant) => {
      editor.updateShape({
        id: shape.id,
        type: "callout",
        props: { ...shape.props, variant: next },
      });
    },
    [editor, shape.id, shape.props],
  );

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: "all" }}>
      <CalloutShapeView
        variant={shape.props.variant}
        body={shape.props.body}
        locked={!canEdit}
        lockedBy={lockedBy}
        onRequestEdit={() => {
          if (!canEdit) return;
          editor.setEditingShape(shape.id);
        }}
      />
      <CalloutEditDialogWrapper
        open={editing}
        initialContent={shape.props.body}
        variant={shape.props.variant}
        onVariantChange={handleVariantChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </HTMLContainer>
  );
}

// Thin wrapper that pipes Callout-specific i18n keys + variant picker
// into the shared MarkdownEditDialog component.
function CalloutEditDialogWrapper(props: {
  open: boolean;
  initialContent: string;
  variant: CalloutVariant;
  onVariantChange: (next: CalloutVariant) => void;
  onSubmit: (next: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { variant, onVariantChange, ...rest } = props;
  return (
    <MarkdownEditDialog
      {...rest}
      headerExtras={<CalloutVariantPicker variant={variant} onChange={onVariantChange} />}
      title={t("shapes.callout.editDialogTitle")}
      placeholder={t("shapes.callout.editPlaceholder")}
    />
  );
}

// ---------------------------------------------------------------------------
// Link card shape
// ---------------------------------------------------------------------------

const LINK_CARD_STATE_VALIDATOR = T.literalEnum("pending", "success", "error");

export type LinkCardShape = TLBaseShape<
  "link-card",
  {
    url: string;
    state: LinkCardState;
    metadata: LinkCardMetadata | null;
    fetchedAt: string | null;
    w: number;
    h: number;
  }
>;

const LINK_CARD_PROPS: RecordProps<LinkCardShape> = {
  url: T.string,
  state: LINK_CARD_STATE_VALIDATOR as unknown as RecordProps<LinkCardShape>["state"],
  metadata: T.jsonValue.nullable() as unknown as RecordProps<LinkCardShape>["metadata"],
  fetchedAt: T.string.nullable(),
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
};

export class LinkCardShapeUtil extends ShapeUtil<LinkCardShape> {
  static override type = "link-card" as const;
  static override props = LINK_CARD_PROPS;

  override getDefaultProps(): LinkCardShape["props"] {
    return {
      url: "",
      state: "pending",
      metadata: null,
      fetchedAt: null,
      w: 360,
      h: 220,
    };
  }
  override canEdit() {
    return true;
  }
  override canResize() {
    return true;
  }
  override getGeometry(shape: LinkCardShape) {
    return boxGeometry(shape);
  }
  override onResize(shape: LinkCardShape, info: TLResizeInfo<LinkCardShape>) {
    return resizeBox(shape, info);
  }
  override component(shape: LinkCardShape) {
    return <LinkCardShapeWrapper shape={shape} />;
  }
  override indicator(shape: LinkCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

async function fetchOgMetadata(url: string): Promise<LinkCardMetadata | null> {
  try {
    const resp = await fetch("/api/og", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as { data?: LinkCardMetadata & { fetchedAt?: string } };
    return body.data ?? null;
  } catch {
    return null;
  }
}

function LinkCardShapeWrapper({ shape }: { shape: LinkCardShape }) {
  const editor = useEditor();
  const { canEdit, lockedBy } = useEditLockForShape(shape.id);

  const stored: LinkCardStored = {
    state: shape.props.state,
    url: shape.props.url,
    metadata: shape.props.metadata,
    fetchedAt: shape.props.fetchedAt,
  };

  // Auto-refresh stale success cards. Side effects MUST live in
  // useEffect — running them in the render body produces an infinite
  // re-render loop because the resulting updateShape() re-fires the
  // wrapper which re-checks the stale flag, etc.
  useEffect(() => {
    if (shape.props.state !== "success") return;
    if (!isStale(shape.props.fetchedAt, new Date().toISOString())) return;
    editor.updateShape({
      id: shape.id,
      type: "link-card",
      props: { ...shape.props, state: "pending", metadata: null, fetchedAt: null },
    });
    // Re-running this effect when shape.props changes is fine; the
    // stale check + state guard prevents looping after the update.
  }, [editor, shape.id, shape.props.state, shape.props.fetchedAt, shape.props]);

  // Drive pending → success/error via /api/og. Use a ref to track which
  // url we already fetched in this mount so a second render after the
  // resulting updateShape() doesn't re-fire the request.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (shape.props.state !== "pending") return;
    if (!shape.props.url) return;
    if (fetchedFor.current === shape.props.url) return;
    fetchedFor.current = shape.props.url;
    let cancelled = false;
    void (async () => {
      const data = await fetchOgMetadata(shape.props.url);
      if (cancelled) return;
      const fetchedAt = new Date().toISOString();
      if (data === null) {
        editor.updateShape({
          id: shape.id,
          type: "link-card",
          props: { ...shape.props, state: "error", metadata: null, fetchedAt: null },
        });
      } else {
        editor.updateShape({
          id: shape.id,
          type: "link-card",
          props: { ...shape.props, state: "success", metadata: data, fetchedAt },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, shape.id, shape.props.state, shape.props.url, shape.props]);

  const onRetry = useCallback(() => {
    if (!canEdit) return;
    const next = nextLinkCardState(stored, { kind: "retry" });
    editor.updateShape({
      id: shape.id,
      type: "link-card",
      props: { ...shape.props, ...next },
    });
  }, [canEdit, editor, shape.id, shape.props, stored]);

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: "all" }}>
      <LinkCardShapeView stored={stored} locked={!canEdit} lockedBy={lockedBy} onRetry={onRetry} />
    </HTMLContainer>
  );
}

// ---------------------------------------------------------------------------
// Aggregate exports for shape registration in Editor.tsx
// ---------------------------------------------------------------------------

export const customShapeUtilClasses = [
  MarkdownShapeUtil,
  CodeShapeUtil,
  CalloutShapeUtil,
  LinkCardShapeUtil,
] as const;
