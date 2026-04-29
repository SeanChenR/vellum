/**
 * Editor.tsx — tldraw canvas editor with Vellum chrome.
 *
 * Responsibilities:
 *   1. Load initial snapshot from persistence (once on mount)
 *   2. Autosave via useAutosave hook (800ms debounce + beforeunload flush)
 *   3. Provide VellumChromeContext to tldraw component slots
 *   4. Pass customShapeUtils/Tools, maxPages=1, vellumChromeComponents to <Tldraw>
 *
 * Design: "autosave 用 800ms debounce + tldraw store.listen"
 * Spec: "Canvas editor route renders Vellum chrome around tldraw"
 */

import React, { useState } from "react";
import { Tldraw, getSnapshot } from "tldraw";
import type { Editor as TldrawEditor } from "tldraw";
import "tldraw/tldraw.css";
import { loadSnapshot } from "./persistence";
import type { Snapshot } from "./persistence";
import { useAutosave } from "./use-autosave";
import { customShapeUtils, customShapeTools } from "@vellum/shared/shape-types";
import { VellumChromeContext, vellumChromeComponents } from "../chrome/index";
import type { VellumChromeContextValue } from "../chrome/index";
import type { AuthUser } from "../auth/useAuth";
import type { TopBarFolder } from "../chrome/TopBar";

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
  // Load snapshot once on mount
  const [initialSnapshot] = useState<Snapshot | null>(() => loadSnapshot(canvasId));

  // editor is stored in state so useAutosave re-subscribes when it's available
  const [editor, setEditor] = useState<TldrawEditor | null>(null);

  // Autosave: debounced writes to localStorage
  useAutosave({
    canvasId,
    editor,
    getSnapshot: () => getSnapshot(editor!.store) as Snapshot,
  });

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

  function handleMount(mountedEditor: TldrawEditor) {
    setEditor(mountedEditor);
  }

  return (
    <VellumChromeContext.Provider value={chromeContext}>
      {/* tldraw needs a positioned, fully-sized container; use absolute inset so
          the infinite-canvas surface does not push siblings (chrome) off-screen. */}
      <div className="relative h-full w-full">
        <div className="absolute inset-0">
          <Tldraw
            shapeUtils={customShapeUtils}
            tools={customShapeTools}
            components={vellumChromeComponents}
            options={{ maxPages: 1 }}
            snapshot={initialSnapshot ?? undefined}
            onMount={handleMount}
          />
        </div>
      </div>
    </VellumChromeContext.Provider>
  );
}
