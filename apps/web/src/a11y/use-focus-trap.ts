/**
 * useFocusTrap — keep keyboard focus inside a container while active.
 *
 * Spec: a11y — "System provides a reusable focus-trap React hook".
 *
 * On activation:
 *   1. Save document.activeElement → previousFocus
 *   2. Find first focusable inside ref.current and call .focus() on it
 * On Tab inside the container:
 *   - If focused element === last focusable, prevent default + focus first
 *   - If Shift+Tab on first focusable, prevent default + focus last
 * On deactivation / unmount:
 *   - Try to restore focus to previousFocus; swallow errors if it's gone
 *
 * Phase 1 scope: top-level dialogs only. The hook does not handle
 * contenteditable nodes, shadow DOM boundaries, or iframes.
 */

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface UseFocusTrapOptions<T extends HTMLElement> {
  active: boolean;
  ref: React.RefObject<T | null>;
}

export function useFocusTrap<T extends HTMLElement>({ active, ref }: UseFocusTrapOptions<T>): void {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    // Capture the element that had focus before the trap activated.
    previousFocus.current = (document.activeElement as HTMLElement | null) ?? null;

    // Move focus to the first focusable descendant.
    const focusables = getFocusables(container);
    focusables[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = getFocusables(container!);
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const focused = document.activeElement;

      if (e.shiftKey) {
        if (focused === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (focused === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Restore focus, swallowing errors if the previous element is gone.
      const prev = previousFocus.current;
      previousFocus.current = null;
      if (prev && document.body.contains(prev)) {
        try {
          prev.focus();
        } catch {
          // best-effort restore
        }
      }
    };
  }, [active, ref]);
}

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
  );
}
