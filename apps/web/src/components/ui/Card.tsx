/**
 * Card — Aura redesign card primitive.
 *
 * Spec ref: openspec/specs/public-pages/spec.md
 *   "HomePage feature cards use the elevated Card primitive"
 *   openspec/specs/motion-system/spec.md
 *   "Card hover-ring transition is bounded and respects reduced-motion"
 *
 * Variants:
 *   default   — bg-surface + border, 24 px padding
 *   elevated  — bg-surface-elevated + border + shadow-md, used for
 *               authentication cards / profile form
 *   outlined  — transparent bg + border, used inside nested lists
 *   hover-ring — default + 2 px accent-purple ring on pointer hover,
 *                transition ≤ 200 ms (`transition-shadow duration-150`)
 *
 * `prefers-reduced-motion: reduce` collapses the hover-ring transition
 * to 0 s via `apps/web/src/styles.css` :: `.v-card-hover-ring` rule.
 */

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export type CardVariant = "default" | "elevated" | "outlined" | "hover-ring";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "bg-surface border border-border",
  elevated: "bg-surface-elevated border border-border shadow-md",
  outlined: "bg-transparent border border-border",
  "hover-ring":
    "bg-surface border border-border v-card-hover-ring transition-shadow duration-150 hover:shadow-[0_0_0_2px_var(--accent-purple)]",
};

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", className = "", ...rest },
  ref,
) {
  const variantClass = VARIANT_CLASSES[variant];
  const composed = ["rounded-2xl p-6", variantClass, className].filter(Boolean).join(" ");
  return <div ref={ref} data-variant={variant} className={composed} {...rest} />;
});
