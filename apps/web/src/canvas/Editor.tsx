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

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { customShapeUtils, customShapeTools } from "@vellum/shared/shape-types";
import { VellumChromeContext, vellumChromeComponents } from "../chrome/index";
import type { VellumChromeContextValue } from "../chrome/index";
import type { AuthUser } from "../auth/useAuth";
import type { TopBarFolder } from "../chrome/TopBar";
import { useSyncStore } from "./use-sync-store";
import { ShareDialog } from "./ShareDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorProps {
  canvasId: string;
  title: string;
  folder: TopBarFolder | null;
  /** Owner user id of the canvas — used to gate the Share button. */
  ownerId: string;
  onRenameSubmit: (newTitle: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  currentUser: AuthUser | null;
  onSignOut: () => void;
  /** Optional public-link share token — passed to the sync hook. */
  shareToken?: string;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function Editor({
  canvasId,
  title,
  folder,
  ownerId,
  onRenameSubmit,
  onDuplicate,
  onDelete,
  currentUser,
  onSignOut,
  shareToken,
}: EditorProps) {
  const { t } = useTranslation();
  const sync = useSyncStore(canvasId, { shareToken });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const isOwner = currentUser?.id === ownerId;
  const isReadOnly = sync.role === "viewer";

  const chromeContext: VellumChromeContextValue = {
    topBar: {
      canvasId,
      title,
      folder,
      onShareClick: () => setShareDialogOpen(true),
      onRenameSubmit,
      // Anonymous public-link visitors don't have a currentUser; surface a
      // synthetic one for the chrome that hides identity-bearing controls.
      currentUser: currentUser ?? {
        id: "anon",
        email: "",
        name: t("canvas.chrome.topbar.anonymousLabel", { animal: "Visitor" }),
        image: null,
        locale: "en",
        createdAt: new Date().toISOString(),
      },
      onSignOut,
      isOwner,
      isReadOnly,
    },
    mainMenu: {
      onRename: () => {},
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
              onMount={(editor) => {
                // tldraw v4 sets readonly via instance state; the prop isn't
                // exposed on TldrawProps. Server-side enforcement still wins
                // (TLSocketRoom drops mutations from readonly sessions); this
                // is purely a client-UI affordance so the toolbar reflects it.
                editor.updateInstanceState({ isReadonly: isReadOnly });
              }}
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
      {isOwner && shareDialogOpen && (
        // Mount lazily so useShareState's query does not fire until the
        // dialog is actually opened. Tests that don't trigger Share also
        // skip the QueryClient wiring.
        <ShareDialog open canvasId={canvasId} onClose={() => setShareDialogOpen(false)} />
      )}
    </VellumChromeContext.Provider>
  );
}
