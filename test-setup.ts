/**
 * Bun test preload — registers happy-dom globals for component tests.
 *
 * Server-only tests (e.g. apps/api/src/lib/*.test.ts) don't reference
 * DOM types and ignore these globals. Component tests in apps/web need
 * `document`, `window`, `localStorage`, etc.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({ url: "http://localhost:3001" });
}
