import { cn } from "@/lib/utils";

export type PortalSegmentedTab = {
  id: string;
  label: string;
  /** Optional two-line label (mobile-style); web uses first line only unless `allowMultiline`. */
  multilineLabel?: string;
};

type PortalSegmentedTabsProps = {
  value: string;
  onChange: (id: string) => void;
  tabs: PortalSegmentedTab[];
  className?: string;
  /** When true, `multilineLabel` may render on two lines (profile tabs on narrow viewports). */
  allowMultiline?: boolean;
};

export function PortalSegmentedTabs({
  value,
  onChange,
  tabs,
  className,
  allowMultiline = false,
}: PortalSegmentedTabsProps) {
  return (
    <div
      className={cn("w-full max-w-2xl", className)}
      role="tablist"
      aria-orientation="horizontal"
    >
      <div className="inline-flex w-full max-w-2xl rounded-lg border border-border overflow-hidden bg-card shadow-sm">
        {tabs.map((tab) => {
          const active = value === tab.id;
          const display =
            allowMultiline && tab.multilineLabel ? tab.multilineLabel : tab.label;
          const isMultiline = allowMultiline && display.includes("\n");
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex-1 min-h-11 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors text-center leading-tight",
                active
                  ? "bg-primary text-sidebar"
                  : "bg-card text-sidebar hover:bg-muted/40",
              )}
            >
              {isMultiline ? (
                <span className="whitespace-pre-line">{display}</span>
              ) : (
                <span className="whitespace-normal">{display}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
