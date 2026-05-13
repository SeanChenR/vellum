/**
 * Tabs — Account page tab navigation primitive.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 10
 * Spec ref:   openspec/specs/account/spec.md
 *   "Account settings live under a single tabbed route" — WAI-ARIA tabs
 *   pattern with aria-selected/aria-controls on each tab and matching
 *   `tabpanel-<id>` ids on each panel.
 */

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className = "" }: TabsProps) {
  return (
    <div
      role="tablist"
      className={["flex border-b border-border", className].filter(Boolean).join(" ")}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const cls = [
          "focus-visible-ring -mb-px h-11 px-4 text-sm font-medium transition-colors duration-150",
          "border-b-2",
          isActive
            ? "border-accent-purple text-text-primary"
            : "border-transparent text-text-muted hover:text-text-primary",
        ].join(" ");
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${item.id}`}
            id={`tab-${item.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              onChange(item.id);
            }}
            className={cls}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
