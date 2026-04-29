/**
 * use-autosave.ts — debounced autosave hook for tldraw canvas.
 *
 * Encapsulates:
 *   - store.listen subscription
 *   - 800ms trailing-edge debounce
 *   - quota fail-fast (stops writes after first failure)
 *   - beforeunload flush
 *
 * Spec: "Editor autosaves snapshots on a debounced cadence and on page unload"
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "tldraw";
import { saveSnapshot } from "./persistence";
import type { Snapshot } from "./persistence";

const DEBOUNCE_MS = 800;

export interface UseAutosaveOptions {
  canvasId: string;
  editor: Editor | null;
  getSnapshot: () => Snapshot;
}

export function useAutosave({ canvasId, editor, getSnapshot }: UseAutosaveOptions) {
  const { t } = useTranslation();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quotaBlockedRef = useRef(false);
  const toastShownRef = useRef(false);

  function doSave() {
    if (quotaBlockedRef.current) return;
    const snap = getSnapshot();
    const result = saveSnapshot(canvasId, snap);
    if (!result.ok && !toastShownRef.current) {
      toastShownRef.current = true;
      quotaBlockedRef.current = true;
      window.dispatchEvent(
        new CustomEvent("vellum:toast", {
          detail: { message: t("canvas.chrome.persistence.quotaExceededToast") },
        }),
      );
    }
  }

  function flushDebounce() {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      doSave();
    }
  }

  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.store.listen(() => {
      if (quotaBlockedRef.current) return;
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        doSave();
      }, DEBOUNCE_MS);
    });

    const onBeforeUnload = () => flushDebounce();
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, canvasId]);
}
