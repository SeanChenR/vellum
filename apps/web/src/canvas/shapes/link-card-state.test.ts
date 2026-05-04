/**
 * link-card-state tests — state machine for the Link card shape.
 *
 * Spec: canvas-shapes — "Link card shape transitions through pending /
 * success / error states".
 *
 * The reducer is a pure function: (current, event) → next. The shape
 * stores `{ state, url, metadata, fetchedAt }` in tldraw props; this
 * file owns the rules for advancing that state in response to fetch
 * outcomes, user actions, and time.
 */

import { describe, expect, test } from "bun:test";
import {
  isStale,
  nextLinkCardState,
  STALE_TTL_MS,
  type LinkCardEvent,
  type LinkCardStored,
} from "./link-card-state";

const NOW_ISO = "2026-05-04T10:00:00.000Z";
const HOUR_MS = 60 * 60 * 1000;

const initialPending: LinkCardStored = {
  state: "pending",
  url: "https://example.com",
  metadata: null,
  fetchedAt: null,
};

const successState: LinkCardStored = {
  state: "success",
  url: "https://example.com",
  metadata: { title: "Example", siteName: "Example Inc." },
  fetchedAt: NOW_ISO,
};

const errorState: LinkCardStored = {
  state: "error",
  url: "https://example.com",
  metadata: null,
  fetchedAt: null,
};

describe("nextLinkCardState — pending transitions", () => {
  test("pending + fetch-success → success with stored metadata + fetchedAt", () => {
    const ev: LinkCardEvent = {
      kind: "fetch-success",
      metadata: { title: "Hi", siteName: "Site" },
      fetchedAt: NOW_ISO,
    };
    const next = nextLinkCardState(initialPending, ev);
    expect(next.state).toBe("success");
    expect(next.metadata?.title).toBe("Hi");
    expect(next.fetchedAt).toBe(NOW_ISO);
    expect(next.url).toBe(initialPending.url);
  });

  test("pending + fetch-error → error", () => {
    const next = nextLinkCardState(initialPending, { kind: "fetch-error" });
    expect(next.state).toBe("error");
    expect(next.metadata).toBeNull();
  });
});

describe("nextLinkCardState — error transitions", () => {
  test("error + retry → pending (clears metadata)", () => {
    const next = nextLinkCardState(errorState, { kind: "retry" });
    expect(next.state).toBe("pending");
    expect(next.metadata).toBeNull();
  });
});

describe("nextLinkCardState — success transitions", () => {
  test("success + url-change → pending with new url, cleared metadata", () => {
    const next = nextLinkCardState(successState, {
      kind: "url-change",
      newUrl: "https://other.com",
    });
    expect(next.state).toBe("pending");
    expect(next.url).toBe("https://other.com");
    expect(next.metadata).toBeNull();
    expect(next.fetchedAt).toBeNull();
  });

  test("success + url-change to the same url → no transition (still success)", () => {
    const next = nextLinkCardState(successState, {
      kind: "url-change",
      newUrl: successState.url,
    });
    expect(next.state).toBe("success");
    expect(next.metadata).toEqual(successState.metadata);
  });

  test("success + retry → pending (forced re-fetch)", () => {
    const next = nextLinkCardState(successState, { kind: "retry" });
    expect(next.state).toBe("pending");
    expect(next.metadata).toBeNull();
  });
});

describe("isStale", () => {
  test("fetchedAt 25 hours ago → stale", () => {
    const fetched = new Date(Date.parse(NOW_ISO) - 25 * HOUR_MS).toISOString();
    expect(isStale(fetched, NOW_ISO)).toBe(true);
  });

  test("fetchedAt 23 hours ago → fresh", () => {
    const fetched = new Date(Date.parse(NOW_ISO) - 23 * HOUR_MS).toISOString();
    expect(isStale(fetched, NOW_ISO)).toBe(false);
  });

  test("null fetchedAt → considered stale (no fetch yet)", () => {
    expect(isStale(null, NOW_ISO)).toBe(true);
  });

  test("STALE_TTL_MS equals 24 hours", () => {
    expect(STALE_TTL_MS).toBe(24 * HOUR_MS);
  });
});

describe("nextLinkCardState — stale auto-refresh on render", () => {
  test("success + render with stale fetchedAt → pending", () => {
    const stale: LinkCardStored = {
      state: "success",
      url: "https://example.com",
      metadata: { title: "Old" },
      fetchedAt: new Date(Date.parse(NOW_ISO) - 25 * HOUR_MS).toISOString(),
    };
    const next = nextLinkCardState(stale, { kind: "render", nowIso: NOW_ISO });
    expect(next.state).toBe("pending");
    // Old metadata cleared so the placeholder shows during re-fetch
    expect(next.metadata).toBeNull();
  });

  test("success + render with fresh fetchedAt → still success (no transition)", () => {
    const next = nextLinkCardState(successState, { kind: "render", nowIso: NOW_ISO });
    expect(next.state).toBe("success");
    expect(next.metadata).toEqual(successState.metadata);
  });

  test("pending + render → pending (render does not affect non-success states)", () => {
    const next = nextLinkCardState(initialPending, { kind: "render", nowIso: NOW_ISO });
    expect(next.state).toBe("pending");
  });
});
