/**
 * persistence.ts — Phase 1 暫時方案，將由 add-multiplayer-sync 取代。
 * Spec: "Persistence module loads and saves snapshots in localStorage with a 5MB cap"
 */

import type { getSnapshot } from "tldraw";

export type Snapshot = ReturnType<typeof getSnapshot>;
export type SaveResult = { ok: true } | { ok: false; reason: "too_large" | "quota" };

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MiB = 5,242,880 bytes

function keyFor(canvasId: string): string {
  return `vellum:canvas:${canvasId}:snapshot`;
}

function serialize(snapshot: Snapshot): string {
  return JSON.stringify(snapshot);
}

function deserialize(raw: string): Snapshot | null {
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

// Internal storage ref — injectable for testing; defaults to globalThis.localStorage.
/** @internal */ export let _storage: Pick<Storage, "getItem" | "setItem"> = localStorage;
/** @internal */ export function _setStorage(s: Pick<Storage, "getItem" | "setItem">): void {
  _storage = s;
}

/** Load a snapshot. Returns null on missing key or malformed JSON. Never throws. */
export function loadSnapshot(canvasId: string): Snapshot | null {
  const raw = _storage.getItem(keyFor(canvasId));
  if (raw === null) return null;
  return deserialize(raw);
}

/**
 * Save a snapshot. Pre-checks 5MB cap before calling setItem.
 * Returns { ok: false, reason: 'too_large' } if payload > 5MB (setItem not called).
 * Returns { ok: false, reason: 'quota' } if setItem throws QuotaExceededError.
 * Never throws to caller.
 */
export function saveSnapshot(canvasId: string, snapshot: Snapshot): SaveResult {
  const serialized = serialize(snapshot);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  try {
    _storage.setItem(keyFor(canvasId), serialized);
    return { ok: true };
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22)
    ) {
      return { ok: false, reason: "quota" };
    }
    return { ok: false, reason: "quota" };
  }
}
