/**
 * Button — Aura redesign button primitive.
 *
 * Variants: primary (accent-purple bg) / secondary (border + text) /
 * ghost (transparent) / destructive (text-accent-red, hover bg-soft).
 * Sizes: sm (32 px) / md (40 px) / lg (48 px).
 *
 * forwardRef so callers can wire it as a submit button on RHF forms or
 * pass to Radix/headless primitives.
 */

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-base rounded-xl",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-purple text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-surface text-text-primary border border-border hover:border-accent-purple hover:text-accent-purple disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-text-primary hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed",
  destructive:
    "bg-transparent text-accent-red hover:bg-accent-red/10 disabled:opacity-50 disabled:cursor-not-allowed",
};

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconRight, className = "", children, type, ...rest },
  ref,
) {
  const composed = [
    "focus-visible-ring inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      data-variant={variant}
      data-size={size}
      className={composed}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});
