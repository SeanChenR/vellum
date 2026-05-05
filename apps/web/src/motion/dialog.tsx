/**
 * motion/dialog — enter / exit motion wrapper for modal dialogs.
 *
 * Spec: motion-system — "Existing dialogs receive enter and exit motion".
 *
 * Each dialog wraps its overlay + panel content in `<DialogMotion>`
 * which handles mount + unmount transitions:
 *   - Overlay: opacity 0 → 1 (and back) over 180ms.
 *   - Panel: scale 0.95 → 1 + opacity 0 → 1 (and back) over 180ms.
 *
 * `prefers-reduced-motion: reduce` collapses both transitions to 0ms
 * with no transform offset.
 *
 * Usage:
 *   <DialogMotion open={open} ...>
 *     <DialogPanel ...>
 *       ...content
 *     </DialogPanel>
 *   </DialogMotion>
 *
 * The dialog must NOT short-circuit `if (!open) return null` itself —
 * `<DialogMotion>` handles conditional rendering internally so the
 * exit animation can run before unmount.
 */

import React, { useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFocusTrap } from "../a11y/use-focus-trap";

const DURATION_MS = 180;

interface DialogMotionProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  role?: string;
  ariaLabelledBy?: string;
  ariaModal?: boolean;
}

export function DialogMotion({
  open,
  children,
  className,
  role = "dialog",
  ariaLabelledBy,
  ariaModal = true,
}: DialogMotionProps) {
  const reduce = useReducedMotion();
  const duration = reduce ? 0 : DURATION_MS / 1000;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role={role}
          aria-modal={ariaModal}
          aria-labelledby={ariaLabelledBy}
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DialogPanelProps {
  children: ReactNode;
  className?: string;
}

export function DialogPanel({ children, className }: DialogPanelProps) {
  const reduce = useReducedMotion();
  const duration = reduce ? 0 : DURATION_MS / 1000;
  const ref = useRef<HTMLDivElement>(null);
  // Trap focus while the panel is mounted. AnimatePresence keeps the panel
  // mounted only while the surrounding DialogMotion is `open`, so this is
  // equivalent to "trap is active iff dialog is open".
  useFocusTrap({ active: true, ref });
  return (
    <motion.div
      ref={ref}
      initial={{ scale: reduce ? 1 : 0.95, opacity: reduce ? 1 : 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: reduce ? 1 : 0.95, opacity: 0 }}
      transition={{ duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Exposed for integration tests that mock reduced-motion behaviour. */
export const DIALOG_MOTION_DURATION_MS = DURATION_MS;
