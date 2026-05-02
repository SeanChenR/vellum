/**
 * Read-only spike (task 1.1, temporary).
 *
 * Confirms the architectural assumption from the add-sharing design's
 * "Viewer-mode read-only：client + server 雙閘" decision: passing
 * `isReadonly: true` to `TLSocketRoom.handleSocketConnect` flows through
 * to the underlying TLSyncRoom session and is visible via `getSessions()`.
 *
 * Source-level proof (read but not asserted at runtime here): TLSyncRoom
 * line 1031 short-circuits when `session.isReadonly` is true, dropping the
 * push diff before broadcast. The negative path is enforced by tldraw, so
 * we only validate the flag plumbing in this spike.
 *
 * This file is removed by task 3.7 once the integration test in
 * `index.test.ts` exercises the same path end-to-end.
 */

import { expect, test } from "bun:test";
import { TLSocketRoom, type WebSocketMinimal } from "@tldraw/sync-core";

function makeFakeSocket(): WebSocketMinimal {
  return {
    send() {},
    close() {},
    get readyState() {
      return 1;
    },
  };
}

test("TLSocketRoom records isReadonly on the session it creates", () => {
  const room = new TLSocketRoom<never, void>({});
  room.handleSocketConnect({
    sessionId: "spike-viewer",
    socket: makeFakeSocket(),
    isReadonly: true,
  });
  const sessions = room.getSessions();
  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.isReadonly).toBe(true);
});

test("Default handleSocketConnect (no flag) creates a writable session", () => {
  const room = new TLSocketRoom<never, void>({});
  room.handleSocketConnect({
    sessionId: "spike-editor",
    socket: makeFakeSocket(),
  });
  const sessions = room.getSessions();
  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.isReadonly).toBe(false);
});
