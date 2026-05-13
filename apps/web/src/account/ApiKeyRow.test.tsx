/**
 * ApiKeyRow component tests.
 *
 * Extracted from ApiKeysPage as a props-driven row that renders the same
 * empty / saved interaction logic for any of the three supported providers.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Settings API Keys page UI" — every row behaves identically across
 *     anthropic / openai / google.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ApiKeyRow } from "./ApiKeyRow";

interface ProviderListItem {
  provider: string;
  createdAt: string;
  lastUsedAt: string | null;
}

type PreferencesMap = Partial<
  Record<"anthropic" | "openai" | "google", { model: string; updatedAt: string }>
>;

interface FetchState {
  list: ProviderListItem[];
  preferences: PreferencesMap;
  saveResult: { ok: true } | { ok: false; status: number; error: string };
  patchCalls: Array<{ provider: string; model: string }>;
}

let fetchState: FetchState;

function makeFetchMock(): ReturnType<typeof mock> {
  return mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/account/byok") && method === "GET") {
      return Response.json({
        data: { keys: fetchState.list, preferences: fetchState.preferences },
      });
    }

    if (url.endsWith("/api/account/byok/preferences") && method === "PATCH") {
      const body = JSON.parse(init?.body as string) as { provider: string; model: string };
      fetchState.patchCalls.push(body);
      const updatedAt = new Date().toISOString();
      fetchState.preferences = {
        ...fetchState.preferences,
        [body.provider]: { model: body.model, updatedAt },
      } as PreferencesMap;
      return Response.json({
        data: { provider: body.provider, model: body.model, updatedAt },
      });
    }

    const m = url.match(/\/api\/account\/byok\/([^/]+)$/);
    if (m && method === "POST") {
      const provider = m[1]!;
      if (fetchState.saveResult.ok) {
        const newRow: ProviderListItem = {
          provider,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        };
        fetchState.list = [...fetchState.list.filter((r) => r.provider !== provider), newRow];
        return Response.json({ data: newRow });
      }
      return Response.json(
        { error: fetchState.saveResult.error },
        { status: fetchState.saveResult.status },
      );
    }
    if (m && method === "DELETE") {
      const provider = m[1]!;
      fetchState.list = fetchState.list.filter((r) => r.provider !== provider);
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: "errors.validation" }, { status: 400 });
  });
}

beforeEach(async () => {
  fetchState = { list: [], preferences: {}, saveResult: { ok: true }, patchCalls: [] };
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = makeFetchMock();
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

function renderRow(provider: "anthropic" | "openai" | "google") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ApiKeyRow provider={provider} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("ApiKeyRow — empty state", () => {
  test("openai: renders password input with provider-specific placeholder + disabled Save", async () => {
    renderRow("openai");
    const input = await screen.findByPlaceholderText("sk-proj-...");
    expect(input.getAttribute("type")).toBe("password");
    const save = screen.getByRole("button", { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  test("google: renders google-specific placeholder", async () => {
    renderRow("google");
    expect(await screen.findByPlaceholderText("AIza...")).toBeTruthy();
  });

  test("typing into input enables Save button", async () => {
    const user = userEvent.setup();
    renderRow("openai");
    const input = await screen.findByPlaceholderText("sk-proj-...");
    await user.type(input, "sk-proj-something");
    const save = screen.getByRole("button", { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("ApiKeyRow — saved state", () => {
  test("renders masked + Delete + Replace when its provider is in the list", async () => {
    fetchState.list = [
      { provider: "openai", createdAt: "2026-05-07T10:00:00.000Z", lastUsedAt: null },
    ];
    renderRow("openai");
    await waitFor(() => {
      expect(screen.getByText(/•+/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /replace/i })).toBeTruthy();
  });

  test("saved row shows <Badge tone='cyan' dot> with the savedBadge i18n string", async () => {
    fetchState.list = [
      { provider: "openai", createdAt: "2026-05-07T10:00:00.000Z", lastUsedAt: null },
    ];
    renderRow("openai");
    await waitFor(() => {
      expect(screen.getByText(/•+/)).toBeTruthy();
    });
    const badge = screen.getByTestId("apikey-saved-badge-openai");
    expect(badge.getAttribute("data-tone")).toBe("cyan");
    expect(badge.querySelector("[data-testid='badge-dot']")).not.toBeNull();
    expect(badge.textContent).toContain("Connected");
  });

  test("unsaved row does NOT render the cyan saved badge", async () => {
    renderRow("google");
    await screen.findByPlaceholderText("AIza...");
    expect(screen.queryByTestId("apikey-saved-badge-google")).toBeNull();
  });

  test("a different provider's saved row does NOT make this row saved", async () => {
    fetchState.list = [
      { provider: "anthropic", createdAt: "2026-05-07T10:00:00.000Z", lastUsedAt: null },
    ];
    renderRow("openai");
    // openai is NOT saved → should still show empty input
    expect(await screen.findByPlaceholderText("sk-proj-...")).toBeTruthy();
  });
});

describe("ApiKeyRow — mutation behaviour", () => {
  test("save error: errorKey rendered as i18n message; input retains value", async () => {
    fetchState.saveResult = { ok: false, status: 400, error: "errors.byok.invalidKey" };
    const user = userEvent.setup();
    renderRow("openai");

    const input = await screen.findByPlaceholderText("sk-proj-...");
    await user.type(input, "sk-proj-bad-key");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/that key looks invalid/i)).toBeTruthy();
    });
    expect((input as HTMLInputElement).value).toBe("sk-proj-bad-key");
  });

  test("save success: row transitions to saved state", async () => {
    fetchState.saveResult = { ok: true };
    const user = userEvent.setup();
    renderRow("openai");

    const input = await screen.findByPlaceholderText("sk-proj-...");
    await user.type(input, "sk-proj-good-key");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/•+/)).toBeTruthy();
    });
  });
});

describe("ApiKeyRow — embedded default-model dropdown", () => {
  test("renders a dropdown with placeholder + 3 tier options for the row's provider", async () => {
    renderRow("openai");
    // Wait for the GET to settle so the dropdown is fully populated.
    await screen.findByPlaceholderText("sk-proj-...");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")) as HTMLOptionElement[];
    // 1 placeholder + 3 tier options = 4 total
    expect(options).toHaveLength(4);
    const values = options.map((o) => o.value);
    expect(values).toContain("");
    expect(values).toContain("gpt-5");
    expect(values).toContain("gpt-5-mini");
    expect(values).toContain("gpt-5-nano");
    // Other providers' models do NOT appear.
    expect(values).not.toContain("claude-haiku-4-5");
    expect(values).not.toContain("gemini-2.5-pro");
  });

  test("preselects stored preference for the row's provider", async () => {
    fetchState.preferences = {
      openai: { model: "gpt-5-mini", updatedAt: "2026-05-08T10:00:00.000Z" },
    };
    renderRow("openai");

    await waitFor(() => {
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("gpt-5-mini");
    });
  });

  test("shows the unset placeholder when the row's provider has no stored preference", async () => {
    fetchState.preferences = {
      anthropic: { model: "claude-haiku-4-5", updatedAt: "2026-05-08T10:00:00.000Z" },
    };
    renderRow("openai");

    await screen.findByPlaceholderText("sk-proj-...");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  test("changing the dropdown PATCHes preferences for THIS provider only", async () => {
    const user = userEvent.setup();
    renderRow("anthropic");

    await screen.findByPlaceholderText("sk-ant-...");
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await user.selectOptions(select, "claude-sonnet-4-6");

    await waitFor(() => {
      expect(fetchState.patchCalls).toEqual([
        { provider: "anthropic", model: "claude-sonnet-4-6" },
      ]);
    });
  });
});
