/**
 * ApiKeysPage — page-level integration tests.
 *
 * Per-row interaction logic is exercised by ApiKeyRow.test.tsx. This file
 * verifies the page composition: three rows render, pricing table is
 * present, picker is present, and picker changes fire the PATCH
 * preferences mutation against the server.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Settings API Keys page UI"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

type PreferencesMap = Partial<
  Record<"anthropic" | "openai" | "google", { model: string; updatedAt: string }>
>;

interface FetchState {
  keys: ProviderListItem[];
  preferences: PreferencesMap;
  patchCalls: Array<{ provider: string; model: string }>;
}

let fetchState: FetchState;

function makeFetchMock(): ReturnType<typeof mock> {
  return mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.endsWith("/api/account/byok") && method === "GET") {
      return Response.json({
        data: { keys: fetchState.keys, preferences: fetchState.preferences },
      });
    }
    if (url.endsWith("/api/account/byok/preferences") && method === "PATCH") {
      const body = JSON.parse(init?.body as string) as { provider: string; model: string };
      fetchState.patchCalls.push(body);
      return Response.json({
        data: {
          provider: body.provider,
          model: body.model,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    return Response.json({ error: "errors.validation" }, { status: 400 });
  });
}

beforeEach(async () => {
  fetchState = { keys: [], preferences: {}, patchCalls: [] };
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = makeFetchMock();
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ApiKeysPage />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("ApiKeysPage — composition", () => {
  test("renders three provider rows in fixed order: anthropic / openai / google", async () => {
    renderPage();
    expect(await screen.findByPlaceholderText("sk-ant-...")).toBeTruthy();
    expect(screen.getByPlaceholderText("sk-proj-...")).toBeTruthy();
    expect(screen.getByPlaceholderText("AIza...")).toBeTruthy();
  });

  test("renders the pricing table (9 catalog rows)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId("byok-pricing-row")).toHaveLength(9);
    });
  });

  test("each provider row contains its own default-model dropdown", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByLabelText("Default model", { selector: "#default-model-anthropic" }),
      ).toBeTruthy();
    });
    expect(
      screen.getByLabelText("Default model", { selector: "#default-model-openai" }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Default model", { selector: "#default-model-google" }),
    ).toBeTruthy();
  });
});

describe("ApiKeysPage — saved state per provider", () => {
  test("only the saved provider's row is in masked state; others remain in input state", async () => {
    fetchState.keys = [
      { provider: "openai", createdAt: "2026-05-07T10:00:00.000Z", lastUsedAt: null },
    ];
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/•+/)).toBeTruthy();
    });
    // Anthropic + Google still show empty input.
    expect(screen.getByPlaceholderText("sk-ant-...")).toBeTruthy();
    expect(screen.getByPlaceholderText("AIza...")).toBeTruthy();
  });
});

describe("ApiKeysPage — per-provider preferences mutation", () => {
  test("changing the OpenAI row dropdown PATCHes only that provider", async () => {
    const user = userEvent.setup();
    renderPage();

    const select = (await screen.findByLabelText("Default model", {
      selector: "#default-model-openai",
    })) as HTMLSelectElement;
    await user.selectOptions(select, "gpt-5-mini");

    await waitFor(() => {
      expect(fetchState.patchCalls).toEqual([{ provider: "openai", model: "gpt-5-mini" }]);
    });
  });

  test("server-returned preferences preselect each row's stored model", async () => {
    fetchState.preferences = {
      anthropic: { model: "claude-haiku-4-5", updatedAt: "2026-05-07T10:00:00.000Z" },
      google: { model: "gemini-2.5-pro", updatedAt: "2026-05-07T11:00:00.000Z" },
    };
    renderPage();

    await waitFor(() => {
      const anthropicSelect = screen.getByLabelText("Default model", {
        selector: "#default-model-anthropic",
      }) as HTMLSelectElement;
      expect(anthropicSelect.value).toBe("claude-haiku-4-5");
    });
    const googleSelect = screen.getByLabelText("Default model", {
      selector: "#default-model-google",
    }) as HTMLSelectElement;
    expect(googleSelect.value).toBe("gemini-2.5-pro");
    const openaiSelect = screen.getByLabelText("Default model", {
      selector: "#default-model-openai",
    }) as HTMLSelectElement;
    expect(openaiSelect.value).toBe("");
  });
});
