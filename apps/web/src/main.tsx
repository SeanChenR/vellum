// Apply persisted theme BEFORE React mounts so the first paint has the
// correct background. Spec: openspec/specs/theme-switching/spec.md
// "Document theme is applied before React mount".
import { applyInitialTheme } from "./theme/bootstrap-theme";
applyInitialTheme();

import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./i18n";

// Swallow benign Chromium "ResizeObserver loop" warning surfaced by tldraw
// resize listeners — not a real error, not actionable.
const RO_LOOP = "ResizeObserver loop";
const _origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes(RO_LOOP)) return;
  _origConsoleError.apply(console, args);
};
window.addEventListener(
  "error",
  (e) => {
    if (e.message?.includes(RO_LOOP)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  },
  true,
);
const _OrigRO = window.ResizeObserver;
class SilentResizeObserver extends _OrigRO {
  constructor(cb: ResizeObserverCallback) {
    super((entries, observer) => {
      window.requestAnimationFrame(() => {
        try {
          cb(entries, observer);
        } catch (err) {
          if (err instanceof Error && err.message.includes(RO_LOOP)) return;
          throw err;
        }
      });
    });
  }
}
window.ResizeObserver = SilentResizeObserver as typeof ResizeObserver;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// NOTE: StrictMode disabled in dev to keep tldraw's getUserPreferences
// migration from running twice (it crashes with "Illegal invocation" on
// the second pass). Re-enable once tldraw 4.5.x compatibility is verified.
createRoot(root).render(<App />);
