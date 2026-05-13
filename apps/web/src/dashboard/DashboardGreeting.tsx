/**
 * DashboardGreeting — top strip of the dashboard with date, welcome
 * line, search input, and "New canvas" primary CTA.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 9
 * Spec ref:   openspec/specs/public-pages/spec.md
 *   "Greeting strip exposes search, primary CTA, and welcome line".
 *
 * Receives `userName` / `searchQuery` / `onSearchChange` / `onCreateClick`
 * — owning state lives in DashboardPage so search-filtering can run on
 * the canvas grid in the sibling column.
 */

import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";

export interface DashboardGreetingProps {
  userName: string;
  searchQuery: string;
  onSearchChange: (next: string) => void;
  onCreateClick: () => void;
}

function todayFormatted(locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date());
}

export function DashboardGreeting({
  userName,
  searchQuery,
  onSearchChange,
  onCreateClick,
}: DashboardGreetingProps) {
  const { t, i18n } = useTranslation();
  const dateLabel = todayFormatted(i18n.language || "zh-TW");
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p
          data-testid="dashboard-greeting-date"
          className="font-mono text-xs uppercase tracking-wider text-text-muted"
        >
          {dateLabel}
        </p>
        <h1
          data-testid="dashboard-greeting-hello"
          className="mt-1 font-serif text-3xl text-text-primary"
        >
          {t("dashboard.greeting.hello", { name: userName })}
        </h1>
      </div>

      <div className="flex w-full items-center gap-2 md:w-auto">
        <div className="relative flex-1 md:w-80">
          <Search
            size={16}
            aria-hidden
            data-testid="dashboard-greeting-search-icon"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
            }}
            placeholder={t("dashboard.searchPlaceholder")}
            className="focus-visible-ring h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onCreateClick}
          data-testid="dashboard-greeting-new-canvas"
          icon={<Plus size={16} aria-hidden data-testid="dashboard-greeting-plus-icon" />}
        >
          {t("dashboard.newCanvasCta")}
        </Button>
      </div>
    </header>
  );
}
