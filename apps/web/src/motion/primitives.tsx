/**
 * motion/primitives — declarative entrance / stagger animation primitives.
 *
 * Spec: motion-system
 *   - "System provides four reusable motion primitives"
 *   - "All motion primitives respect prefers-reduced-motion"
 *
 * 4 primitives cover ~90% of phase 1 motion needs:
 *   <FadeIn>           — opacity 0 → 1
 *   <SlideIn from=…>   — translate offset → 0
 *   <ScaleIn>          — scale 0.95 → 1 + fade
 *   <StaggerContainer> — cascades direct child delays by N ms
 *
 * Every primitive consults `useReducedMotion()` and disables both
 * the duration and the initial offset / opacity when the user has
 * requested reduced motion at the OS level. This is the only place
 * that needs the matchMedia handshake — every page-level animation
 * delegates to these primitives, so reduced-motion is enforced
 * once, here.
 */

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

interface BaseProps {
  /** Delay before the animation starts, in milliseconds. */
  delay?: number;
  /** Duration of the animation, in milliseconds. */
  duration?: number;
  className?: string;
  children: ReactNode;
}

const SLIDE_OFFSET = 24;

// ---------------------------------------------------------------------------
// FadeIn — opacity 0 → 1
// ---------------------------------------------------------------------------

export function FadeIn({ delay = 0, duration = 600, className, children }: BaseProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduce ? 0 : duration / 1000,
        delay: reduce ? 0 : delay / 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SlideIn — translate from one of four directions back to origin + fade
// ---------------------------------------------------------------------------

export type SlideDirection = "left" | "right" | "top" | "bottom";

interface SlideInProps extends BaseProps {
  from: SlideDirection;
}

export function SlideIn({ from, delay = 0, duration = 400, className, children }: SlideInProps) {
  const reduce = useReducedMotion();
  const offset = reduce ? 0 : SLIDE_OFFSET;
  const initial: { x?: number; y?: number; opacity: number } = {
    opacity: reduce ? 1 : 0,
  };
  switch (from) {
    case "left":
      initial.x = -offset;
      break;
    case "right":
      initial.x = offset;
      break;
    case "top":
      initial.y = -offset;
      break;
    case "bottom":
      initial.y = offset;
      break;
  }
  return (
    <motion.div
      initial={initial}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{
        duration: reduce ? 0 : duration / 1000,
        delay: reduce ? 0 : delay / 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ScaleIn — scale 0.95 → 1 + fade (used for emphasis on cards / dialogs)
// ---------------------------------------------------------------------------

interface ScaleInProps extends BaseProps {
  /** Starting scale, defaults to 0.95. */
  initialScale?: number;
}

export function ScaleIn({
  delay = 0,
  duration = 300,
  initialScale = 0.95,
  className,
  children,
}: ScaleInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ scale: reduce ? 1 : initialScale, opacity: reduce ? 1 : 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: reduce ? 0 : duration / 1000,
        delay: reduce ? 0 : delay / 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// StaggerContainer — cascades child entrance delays
// ---------------------------------------------------------------------------

interface StaggerContainerProps {
  /** Interval between sibling animations, in milliseconds. Default 80. */
  staggerMs?: number;
  className?: string;
  children: ReactNode;
}

export function StaggerContainer({ staggerMs = 80, className, children }: StaggerContainerProps) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => {
        if (!isValidElement(child)) return child;
        const delay = reduce ? 0 : i * staggerMs;
        return cloneElement(child as ReactElement<{ delay?: number }>, {
          delay,
          key: child.key ?? i,
        });
      })}
    </div>
  );
}
