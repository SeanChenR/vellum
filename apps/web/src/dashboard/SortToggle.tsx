/**
 * SortToggle — segmented control for switching dashboard sort order.
 *
 * Lives in the canvas section header (right-aligned next to the
 * "我的畫布 / Shared with me" heading) so the sort is anchored to
 * the content it affects. Previously sat in the sidebar — moved out
 * after design feedback that the sidebar should focus on
 * folders/tags scope.
 */

import { useTranslation } from "react-i18next";
import type { SortOrder } from "./useSortOrder";

export interface SortToggleProps {
  value: SortOrder;
  onChange: (next: SortOrder) => void;
}

const ORDERS: readonly SortOrder[] = ["recent", "alphabetical"] as const;

export function SortToggle({ value, onChange }: SortToggleProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("dashboard.sidebar.sortHeading")}
      data-testid="dashboard-sort-toggle"
      className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5"
    >
      {ORDERS.map((order) => {
        const active = order === value;
        const cls = [
          "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          active
            ? "bg-surface-elevated text-text-primary"
            : "text-text-muted hover:text-text-primary",
        ].join(" ");
        return (
          <button
            key={order}
            type="button"
            data-testid={`sort-btn-${order}`}
            aria-pressed={active}
            onClick={() => {
              onChange(order);
            }}
            className={cls}
          >
            {t(`dashboard.sort.${order}`)}
          </button>
        );
      })}
    </div>
  );
}
