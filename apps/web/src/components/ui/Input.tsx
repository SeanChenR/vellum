/**
 * Input — Aura redesign input primitive.
 *
 * Props:
 *   label   — renders an uppercase label above the field
 *   hint    — small muted helper line below the field
 *   icon    — lucide icon rendered absolutely-positioned on the left
 *   error   — error message rendered in accent-red beneath the field
 *             (mutually exclusive with hint — error takes precedence)
 *   suffix  — small mono text on the right (e.g. unit / counter)
 *
 * Focus ring is the global accent-purple via `focus-visible-ring`.
 */

import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export interface InputProps extends Omit<ComponentPropsWithoutRef<"input">, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  error?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, icon, error, suffix, className = "", id: idProp, type, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputClass = [
    "h-10 w-full rounded-lg border border-border bg-surface text-sm text-text-primary",
    "focus-visible-ring placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
    icon ? "pl-[38px] pr-3" : "px-3",
    suffix ? "pr-12" : "",
    error ? "border-accent-red" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            data-testid="input-icon"
          >
            {icon}
          </span>
        )}
        <input ref={ref} id={id} type={type ?? "text"} className={inputClass} {...rest} />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted"
            data-testid="input-suffix"
          >
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-accent-red" data-testid="input-error">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-muted" data-testid="input-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
