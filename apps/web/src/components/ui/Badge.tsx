/**
 * Badge — Aura redesign pill-style label.
 *
 * Tones map to soft accent backgrounds. Used for status indicators
 * (`account.sessions.thisDeviceBadge` etc.). `dot` renders a small
 * inline circle in the same currentColor.
 */

import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type BadgeTone = "cyan" | "purple" | "orange" | "sky" | "muted";

const TONE_CLASSES: Record<BadgeTone, string> = {
  cyan: "bg-accent-cyan/10 text-accent-cyan",
  purple: "bg-accent-purple/10 text-accent-purple",
  orange: "bg-accent-orange/10 text-accent-orange",
  // `sky` is a true-blue, deliberately distinct from `cyan` (teal). Both
  // could otherwise read as "green" in light mode and confuse the tier
  // hierarchy on the pricing table. Uses the Aura `--accent-sky` token
  // so it switches with data-theme.
  sky: "bg-accent-sky/10 text-accent-sky",
  muted: "bg-surface-elevated text-text-muted border border-border",
};

export interface BadgeProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({
  tone = "muted",
  dot = false,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const composed = [
    "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold tracking-wide",
    TONE_CLASSES[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span data-tone={tone} className={composed} {...rest}>
      {dot && (
        <span
          aria-hidden
          data-testid="badge-dot"
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}
