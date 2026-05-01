/**
 * Editor.tsx — tldraw canvas editor with Vellum chrome, mounted on a
 * multiplayer sync store.
 *
 * Responsibilities:
 *   1. Resolve the sync store via `useSyncStore(canvasId)` (lazy WS connect
 *      + DB hydrate are owned by the multiplayer-sync server)
 *   2. Render a loading branch until the store is ready
 *   3. Provide VellumChromeContext to tldraw component slots
 *   4. Pass customShapeUtils / customShapeTools / maxPages=1 / chrome
 *      components to <Tldraw>
 *
 * Spec: canvas-editor — "Editor mounts with a multiplayer-aware sync store"
 */

import { useTranslation } from "react-i18next";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { customShapeUtils, customShapeTools } from "@vellum/shared/shape-types";
import { VellumChromeContext, vellumChromeComponents } from "../chrome/index";
import type { VellumChromeContextValue } from "../chrome/index";
import type { AuthUser } from "../auth/useAuth";
import type { TopBarFolder } from "../chrome/TopBar";
import { useSyncStore } from "./use-sync-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorProps {
  canvasId: string;
  title: string;
  folder: TopBarFolder | null;
  onRenameSubmit: (newTitle: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onShareClick: () => void;
  currentUser: AuthUser;
  onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function Editor({
  canvasId,
  title,
  folder,
  onRenameSubmit,
  onDuplicate,
  onDelete,
  onShareClick,
  currentUser,
  onSignOut,
}: EditorProps) {
  const { t } = useTranslation();
  const sync = useSyncStore(canvasId);

  const chromeContext: VellumChromeContextValue = {
    topBar: {
      canvasId,
      title,
      folder,
      onShareClick,
      onRenameSubmit,
      currentUser,
      onSignOut,
    },
    mainMenu: {
      onRename: () => {
        // TopBar rename dialog is triggered via title click; MainMenu Rename
        // also opens it. Here we just call onRenameSubmit with the sentinel
        // pattern — CanvasPage wires the real mutation.
      },
      onDuplicate,
      onDelete,
    },
  };

  return (
    <VellumChromeContext.Provider value={chromeContext}>
      <div className="relative h-full w-full">
        <div className="absolute inset-0">
          {sync.status === "ready" && sync.store ? (
            <Tldraw
              store={sync.store}
              shapeUtils={customShapeUtils}
              tools={customShapeTools}
              components={vellumChromeComponents}
              options={{ maxPages: 1 }}
            />
          ) : sync.status === "error" ? (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-sm text-red-600">
                {t("canvas.chrome.connection.disconnectedBanner")}
              </span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-sm text-warm-sepia">{t("canvas.chrome.loading")}</span>
            </div>
          )}
        </div>
      </div>
    </VellumChromeContext.Provider>
  );
}
