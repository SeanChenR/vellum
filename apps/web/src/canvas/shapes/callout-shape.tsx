/**
 * callout-shape — view component for the Callout custom shape.
 *
 * Three variants (info / warning / danger) each with a distinct lucide
 * icon and accent color (traditional admonition pattern). The body
 * accepts an inline markdown subset only — block-level constructs
 * (headings, lists, tables, code blocks) render as literal text.
 *
 * Spec: canvas-shapes — "Callout shape renders one of three variants
 * with a lucide icon".
 */

import { AlertOctagon, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export type CalloutVariant = "info" | "warning" | "danger";

export const CALLOUT_VARIANTS: readonly CalloutVariant[] = ["info", "warning", "danger"] as const;

export interface CalloutShapeLockedBy {
  userId: string;
  userName: string;
}

export interface CalloutShapeViewProps {
  variant: CalloutVariant;
  body: string;
  locked: boolean;
  lockedBy: CalloutShapeLockedBy | null;
  onRequestEdit: () => void;
}

interface VariantSpec {
  icon: LucideIcon;
  accentBg: string;
  accentBorder: string;
  iconColor: string;
}

const VARIANT_SPECS: Record<CalloutVariant, VariantSpec> = {
  info: {
    icon: Info,
    accentBg: "bg-blue-50",
    accentBorder: "border-blue-300",
    iconColor: "text-blue-600",
  },
  warning: {
    icon: AlertTriangle,
    accentBg: "bg-amber-50",
    accentBorder: "border-amber-300",
    iconColor: "text-amber-600",
  },
  danger: {
    icon: AlertOctagon,
    accentBg: "bg-red-50",
    accentBorder: "border-red-300",
    iconColor: "text-red-600",
  },
};

export function CalloutShapeView({
  variant,
  body,
  locked,
  lockedBy,
  onRequestEdit,
}: CalloutShapeViewProps) {
  const { t } = useTranslation();
  const spec = VARIANT_SPECS[variant];
  const Icon = spec.icon;

  const handleDoubleClick = () => {
    if (locked) return;
    onRequestEdit();
  };

  return (
    <div
      data-testid="callout-shape-root"
      data-variant={variant}
      onDoubleClick={handleDoubleClick}
      className={`relative flex h-full w-full items-start gap-3 overflow-auto rounded-lg border ${spec.accentBorder} ${spec.accentBg} p-4`}
    >
      {locked && lockedBy && (
        <span
          data-testid="callout-shape-lock-badge"
          className="absolute right-2 top-2 rounded-md bg-ink-navy/85 px-2 py-1 text-xs font-medium text-white"
        >
          {t("shapes.common.lockedBy", { name: lockedBy.userName })}
        </span>
      )}
      <Icon
        data-testid={`callout-icon-${variant}`}
        aria-label={t(`shapes.callout.variants.${variant}`)}
        className={`mt-0.5 h-5 w-5 shrink-0 ${spec.iconColor}`}
      />
      <div
        data-testid="callout-shape-body"
        className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-navy"
      >
        {body}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant picker — used inside the edit dialog header
// ---------------------------------------------------------------------------

export interface CalloutVariantPickerProps {
  variant: CalloutVariant;
  onChange: (next: CalloutVariant) => void;
}

export function CalloutVariantPicker({ variant, onChange }: CalloutVariantPickerProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="callout-variant-picker"
      className="flex items-center gap-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {CALLOUT_VARIANTS.map((v) => {
        const VIcon = VARIANT_SPECS[v].icon;
        const active = v === variant;
        const spec = VARIANT_SPECS[v];
        return (
          <button
            key={v}
            type="button"
            data-testid={`callout-variant-button-${v}`}
            aria-label={t(`shapes.callout.variants.${v}`)}
            aria-pressed={active}
            title={t(`shapes.callout.variants.${v}`)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onChange(v);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition ${
              active
                ? `${spec.accentBorder} ${spec.accentBg} ${spec.iconColor} font-medium`
                : "border-warm-200 bg-white text-gray-500 hover:bg-warm-50"
            }`}
          >
            <VIcon className="h-4 w-4" />
            <span>{t(`shapes.callout.variants.${v}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
