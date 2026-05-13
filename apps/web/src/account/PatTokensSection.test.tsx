/**
 * PatTokensSection.test.tsx — Settings → MCP Tokens panel.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   - "Settings UI presents a MCP Tokens panel for token CRUD"
 *   - "Create-token dialog shows plaintext exactly once"
 *   - "Revoke action requires confirmation and removes the row"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { PatTokensSection } from "./PatTokensSection";

interface PatRow {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface FetchState {
  rows: PatRow[];
  createResult: { ok: true; row: PatRow & { token: string } } | { ok: false; status: number };
  revokeResult: { ok: true } | { ok: false; status: number };
  postCalls: Array<{ name: string; expiresInDays: 30 | 90 | null | undefined }>;
  deleteCalls: string[];
}

let fetchState: FetchState;
const originalFetch = globalThis.fetch;

function makeFetchMock() {
  return mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.endsWith("/api/account/pat") && method === "GET") {
      return Response.json({ data: fetchState.rows });
    }

    if (url.endsWith("/api/account/pat") && method === "POST") {
      const body = JSON.parse(init?.body as string) as {
        name: string;
        expiresInDays: 30 | 90 | null | undefined;
      };
      fetchState.postCalls.push(body);
      if (fetchState.createResult.ok) {
        const { token: _t, ...row } = fetchState.createResult.row;
        fetchState.rows = [row, ...fetchState.rows];
        return Response.json({ data: fetchState.createResult.row }, { status: 201 });
      }
      return Response.json(
        { error: "errors.validation" },
        { status: fetchState.createResult.status },
      );
    }

    const m = url.match(/\/api\/account\/pat\/([^/]+)$/);
    if (m && method === "DELETE") {
      const id = m[1]!;
      fetchState.deleteCalls.push(id);
      if (fetchState.revokeResult.ok) {
        fetchState.rows = fetchState.rows.filter((r) => r.id !== id);
        return new Response(null, { status: 204 });
      }
      return Response.json(
        { error: "errors.notFound" },
        { status: fetchState.revokeResult.status },
      );
    }

    return new Response("not found", { status: 404 });
  });
}

function renderWith() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <PatTokensSection />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchState = {
    rows: [],
    createResult: {
      ok: true,
      row: {
        id: "",
        name: "",
        prefix: "",
        expiresAt: null,
        lastUsedAt: null,
        createdAt: "",
        token: "",
      },
    },
    revokeResult: { ok: true },
    postCalls: [],
    deleteCalls: [],
  };
  globalThis.fetch = makeFetchMock() as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("PatTokensSection — listing", () => {
  test("renders an existing token row with name + masked prefix + last used", async () => {
    fetchState.rows = [
      {
        id: "pat_1",
        name: "Claude Desktop",
        prefix: "vlm_pat_abcd",
        expiresAt: "2026-08-01T00:00:00.000Z",
        lastUsedAt: "2026-05-12T10:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
      },
    ];
    renderWith();

    await waitFor(() => expect(screen.getByText("Claude Desktop")).toBeDefined());
    // Masked prefix is shown as-is (it's only the first 12 chars, not the secret).
    expect(screen.getByText(/vlm_pat_abcd/)).toBeDefined();
  });

  test("renders empty state when no tokens exist", async () => {
    fetchState.rows = [];
    renderWith();
    await waitFor(() => expect(screen.getByText(i18n.t("account.pat.emptyState"))).toBeDefined());
  });
});

describe("PatTokensSection — create flow", () => {
  test("opens dialog, submits with name + 30 days, shows plaintext exactly once", async () => {
    fetchState.createResult = {
      ok: true,
      row: {
        id: "pat_new",
        name: "Cursor",
        prefix: "vlm_pat_ABCD",
        expiresAt: "2026-06-12T00:00:00.000Z",
        lastUsedAt: null,
        createdAt: "2026-05-13T00:00:00.000Z",
        token: "vlm_pat_abcdefghijklmnopqrstuvwxyz123456",
      },
    };
    renderWith();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: i18n.t("account.pat.createButton") }),
      ).toBeDefined(),
    );

    await user.click(screen.getByRole("button", { name: i18n.t("account.pat.createButton") }));
    await waitFor(() =>
      expect(screen.getByLabelText(i18n.t("account.pat.nameLabel"))).toBeDefined(),
    );

    await user.type(screen.getByLabelText(i18n.t("account.pat.nameLabel")), "Cursor");
    // 30 days option is the default — select it explicitly via the radio/select.
    const expiresSelect = screen.getByLabelText(
      i18n.t("account.pat.expiresLabel"),
    ) as HTMLSelectElement;
    await user.selectOptions(expiresSelect, "30");

    await user.click(screen.getByRole("button", { name: i18n.t("account.pat.submitButton") }));

    await waitFor(() =>
      expect(screen.getByText("vlm_pat_abcdefghijklmnopqrstuvwxyz123456")).toBeDefined(),
    );
    expect(screen.getByText(i18n.t("account.pat.plaintextWarning"))).toBeDefined();
    expect(screen.getByRole("button", { name: i18n.t("account.pat.copyButton") })).toBeDefined();

    expect(fetchState.postCalls).toHaveLength(1);
    expect(fetchState.postCalls[0]).toEqual({ name: "Cursor", expiresInDays: 30 });

    // After closing the dialog, plaintext must not be visible anywhere.
    await user.click(screen.getByRole("button", { name: i18n.t("account.pat.doneButton") }));
    await waitFor(() =>
      expect(screen.queryByText("vlm_pat_abcdefghijklmnopqrstuvwxyz123456")).toBeNull(),
    );
    // But the row IS in the list now (refetched after invalidation).
    await waitFor(() => expect(screen.getByText("Cursor")).toBeDefined());
  });
});

describe("PatTokensSection — revoke flow", () => {
  test("revoke requires confirmation and removes the row on success", async () => {
    fetchState.rows = [
      {
        id: "pat_to_revoke",
        name: "Old Token",
        prefix: "vlm_pat_xxxx",
        expiresAt: null,
        lastUsedAt: null,
        createdAt: "2026-05-01T00:00:00.000Z",
      },
    ];
    renderWith();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("Old Token")).toBeDefined());

    await user.click(screen.getByRole("button", { name: i18n.t("account.pat.revokeButton") }));

    // Confirmation dialog appears.
    await waitFor(() =>
      expect(screen.getByText(i18n.t("account.pat.revokeConfirmTitle"))).toBeDefined(),
    );

    await user.click(
      screen.getByRole("button", { name: i18n.t("account.pat.revokeConfirmButton") }),
    );

    await waitFor(() => expect(fetchState.deleteCalls).toEqual(["pat_to_revoke"]));
    await waitFor(() => expect(screen.queryByText("Old Token")).toBeNull());
  });
});
