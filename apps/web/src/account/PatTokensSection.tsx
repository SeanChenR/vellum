/**
 * PatTokensSection — Settings → MCP Tokens panel.
 *
 * Manages Personal Access Tokens for external MCP clients
 * (Claude Desktop, Cursor, etc.). Plaintext is shown exactly once after
 * creation; the server stores only SHA-256 hashes.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   "Settings UI presents a MCP Tokens panel for token CRUD"
 */

import { Copy, Key } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type PatCreatedDto,
  type PatRowDto,
  useCreatePatToken,
  usePatTokens,
  useRevokePatToken,
} from "./usePatTokens";

type ExpiresChoice = "30" | "90" | "never";

function formatRelative(iso: string | null, neverKey: string, t: (k: string) => string): string {
  if (!iso) return t(neverKey);
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const past = diffMs > 0;
  const absSec = Math.abs(Math.floor(diffMs / 1000));
  if (absSec < 60) return past ? "moments ago" : "in moments";
  const m = Math.floor(absSec / 60);
  if (m < 60) return past ? `${m}m ago` : `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return past ? `${h}h ago` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return past ? `${d}d ago` : `in ${d}d`;
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreatePatToken();
  const [name, setName] = useState("");
  const [expires, setExpires] = useState<ExpiresChoice>("30");
  const [created, setCreated] = useState<PatCreatedDto | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const errorKey = create.error instanceof Error ? create.error.message : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const expiresInDays = expires === "never" ? null : (Number(expires) as 30 | 90);
    create.mutate(
      { name: name.trim(), expiresInDays },
      {
        onSuccess(row) {
          setCreated(row);
        },
      },
    );
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopyDone(true);
    } catch {
      /* ignore — user can select-and-copy manually */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pat-create-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg bg-surface p-6">
        {!created ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 id="pat-create-title" className="text-lg font-semibold">
              {t("account.pat.createButton")}
            </h2>
            <div className="space-y-1">
              <label htmlFor="pat-name" className="block text-sm font-medium">
                {t("account.pat.nameLabel")}
              </label>
              <input
                id="pat-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                placeholder={t("account.pat.namePlaceholder")}
                className="w-full rounded border border-border px-3 py-2"
                disabled={create.isPending}
                required
                maxLength={64}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pat-expires" className="block text-sm font-medium">
                {t("account.pat.expiresLabel")}
              </label>
              <select
                id="pat-expires"
                value={expires}
                onChange={(e) => {
                  setExpires(e.target.value as ExpiresChoice);
                }}
                className="w-full rounded border border-border px-3 py-2"
                disabled={create.isPending}
              >
                <option value="30">{t("account.pat.expires30Days")}</option>
                <option value="90">{t("account.pat.expires90Days")}</option>
                <option value="never">{t("account.pat.expiresNever")}</option>
              </select>
            </div>
            {errorKey && <div className="text-sm text-accent-red">{t(errorKey)}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-border px-3 py-1.5 text-sm"
                disabled={create.isPending}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={!name.trim() || create.isPending}
                className="rounded bg-accent-purple px-4 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {t("account.pat.submitButton")}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <h2 id="pat-create-title" className="text-lg font-semibold">
              {created.name}
            </h2>
            <p className="text-sm text-accent-red">{t("account.pat.plaintextWarning")}</p>
            <div
              data-testid="pat-plaintext-reveal"
              className="rounded border border-border bg-accent-cyan/10 p-3 font-mono text-xs break-all"
            >
              {created.token}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm"
              >
                <Copy size={14} aria-hidden data-testid="pat-copy-icon" />
                {t("account.pat.copyButton")}
              </button>
              {copyDone && (
                <span className="text-xs text-accent-cyan">{t("account.pat.copySuccess")}</span>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-accent-purple px-4 py-1.5 text-sm text-white"
              >
                {t("account.pat.doneButton")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RevokeConfirm({
  tokenId,
  tokenName,
  onClose,
}: {
  tokenId: string;
  tokenName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const revoke = useRevokePatToken();
  const errorKey = revoke.error instanceof Error ? revoke.error.message : null;

  function handleConfirm() {
    revoke.mutate(tokenId, {
      onSuccess() {
        onClose();
      },
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pat-revoke-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg bg-surface p-6">
        <h2 id="pat-revoke-title" className="mb-2 text-lg font-semibold">
          {t("account.pat.revokeConfirmTitle")}
        </h2>
        <p className="mb-2 text-sm text-text-muted">{t("account.pat.revokeConfirmBody")}</p>
        <p className="mb-4 text-sm font-medium">{tokenName}</p>
        {errorKey && <div className="mb-3 text-sm text-accent-red">{t(errorKey)}</div>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={revoke.isPending}
            className="rounded border border-border px-3 py-1.5 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={revoke.isPending}
            className="rounded bg-accent-red px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {t("account.pat.revokeConfirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TokenRow({
  row,
  onRevoke,
}: {
  row: PatRowDto;
  onRevoke: (id: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const lastUsedLabel = row.lastUsedAt
    ? t("account.pat.lastUsedAt", {
        when: formatRelative(row.lastUsedAt, "account.pat.lastUsedNever", t),
      })
    : t("account.pat.lastUsedNever");
  const expiresLabel = row.expiresAt
    ? t("account.pat.expiresAt", {
        when: new Date(row.expiresAt).toLocaleDateString(),
      })
    : t("account.pat.expiresNeverDisplay");

  return (
    <div
      data-testid={`pat-token-row-${row.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          data-testid={`pat-token-icon-${row.id}`}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple"
        >
          <Key size={16} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">{row.name}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="font-mono">{row.prefix}…</span>
            <span aria-hidden>·</span>
            <span>{lastUsedLabel}</span>
            <span aria-hidden>·</span>
            <span>{expiresLabel}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onRevoke(row.id, row.name);
        }}
        className="rounded border border-accent-red/40 px-3 py-1.5 text-sm text-accent-red hover:bg-accent-red/10"
      >
        {t("account.pat.revokeButton")}
      </button>
    </div>
  );
}

export function PatTokensSection() {
  const { t } = useTranslation();
  const list = usePatTokens();
  const [showCreate, setShowCreate] = useState(false);
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(null);

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("account.pat.title")}</h2>
          <p className="text-sm text-text-muted">{t("account.pat.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
          }}
          className="rounded bg-accent-purple px-3 py-1.5 text-sm text-white"
        >
          {t("account.pat.createButton")}
        </button>
      </header>

      {list.data && list.data.length === 0 && (
        <p className="text-sm text-text-muted">{t("account.pat.emptyState")}</p>
      )}

      <div className="space-y-2">
        {(list.data ?? []).map((row) => (
          <TokenRow
            key={row.id}
            row={row}
            onRevoke={(id, name) => {
              setRevoking({ id, name });
            }}
          />
        ))}
      </div>

      {showCreate && (
        <CreateDialog
          onClose={() => {
            setShowCreate(false);
          }}
        />
      )}

      {revoking && (
        <RevokeConfirm
          tokenId={revoking.id}
          tokenName={revoking.name}
          onClose={() => {
            setRevoking(null);
          }}
        />
      )}
    </section>
  );
}
