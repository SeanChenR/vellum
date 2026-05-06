/**
 * ApiKeysPage component tests.
 *
 * Scenarios (spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md):
 *   - empty state — input + disabled Save, password field, i18n placeholder
 *   - saved state — masked indicator + Delete + Replace
 *   - mutation error — i18n message rendered, input not cleared
 *   - mutation success — row enters saved state
 *   - delete confirm flow → empty state again
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ApiKeysPage } from "./ApiKeysPage";

interface ProviderListItem {
  provider: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const ANTHROPIC_ROW: ProviderListItem = {
  provider: "anthropic",
  createdAt: "2026-05-06T10:00:00.000Z",
  lastUsedAt: null,
};

interface FetchState {
  list: ProviderListItem[];
  saveResult: { ok: true } | { ok: false; status: number; error: string };
}

let fetchState: FetchState;

function makeFetchMock(): ReturnType<typeof mock> {
  return mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/account/byok") && method === "GET") {
      return Response.json({ data: fetchState.list });
    }

    if (url.match(/\/api\/account\/byok\/[^/]+$/) && method === "POST") {
      if (fetchState.saveResult.ok) {
        const newRow: ProviderListItem = {
          provider: "anthropic",
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        };
        fetchState.list = [newRow];
        return Response.json({ data: newRow });
      }
      return Response.json(
        { error: fetchState.saveResult.error },
        { status: fetchState.saveResult.status },
      );
    }

    if (url.match(/\/api\/account\/byok\/[^/]+$/) && method === "DELETE") {
      fetchState.list = [];
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: "errors.validation" }, { status: 400 });
  });
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(async () => {
  fetchState = { list: [], saveResult: { ok: true } };
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = makeFetchMock();
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

function renderPage() {
  const client = createClient();
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ApiKeysPage />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// 11.1 empty state
// ---------------------------------------------------------------------------

describe("ApiKeysPage — empty state (no keys saved)", () => {
  test("renders password input + disabled Save button + i18n placeholder", async () => {
    renderPage();
    const input = await screen.findByPlaceholderText("sk-ant-...");
    expect(input.getAttribute("type")).toBe("password");
    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11.2 saved state
// ---------------------------------------------------------------------------

describe("ApiKeysPage — saved state (one anthropic row)", () => {
  test("renders masked indicator and Delete + Replace buttons", async () => {
    fetchState.list = [ANTHROPIC_ROW];
    renderPage();
    await waitFor(() => {
      // The component MUST display some kind of masked stand-in (dots)
      // when a key is on file. We probe for the bullet character.
      expect(screen.getByText(/•+/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /replace/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 11.3 mutation error
// ---------------------------------------------------------------------------

describe("ApiKeysPage — save error", () => {
  test("invalid key → i18n error rendered, input retains user value", async () => {
    fetchState.saveResult = { ok: false, status: 400, error: "errors.byok.invalidKey" };
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByPlaceholderText("sk-ant-...");
    await user.type(input, "sk-ant-bad-key-12345");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // i18n value of errors.byok.invalidKey (en)
    await waitFor(() => {
      expect(screen.getByText(/your anthropic key looks invalid/i)).toBeTruthy();
    });
    // Input keeps user value so they can fix the typo.
    expect((input as HTMLInputElement).value).toBe("sk-ant-bad-key-12345");
  });
});

// ---------------------------------------------------------------------------
// 11.4 mutation success
// ---------------------------------------------------------------------------

describe("ApiKeysPage — save success", () => {
  test("valid key → row transitions to masked / saved state", async () => {
    fetchState.saveResult = { ok: true };
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByPlaceholderText("sk-ant-...");
    await user.type(input, "sk-ant-good-key-12345");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/•+/)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 11.5 delete confirm flow
// ---------------------------------------------------------------------------

describe("ApiKeysPage — delete confirm", () => {
  test("Delete + confirm → returns to empty state", async () => {
    fetchState.list = [ANTHROPIC_ROW];
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/•+/)).toBeTruthy();
    });

    // Click the row's Delete button (only one outside any dialog).
    await user.click(screen.getByRole("button", { name: /delete/i }));

    // Confirm inside the modal — scope by role=dialog so we don't
    // accidentally re-click the now-also-present row delete.
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("sk-ant-...")).toBeTruthy();
    });
  });
});
