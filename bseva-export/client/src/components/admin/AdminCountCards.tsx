import { cn } from "@/lib/utils";

export type CountCard = { key: string; label: string; value?: number; tone?: "default" | "warn" | "danger" | "ok" };

const TONES: Record<string, string> = {
  default: "",
  warn: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  ok: "text-emerald-700 dark:text-emerald-300",
};

/** Clickable count tiles that double as a status filter. */
export function AdminCountCards({
  cards,
  active,
  onSelect,
}: {
  cards: CountCard[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onSelect(c.key)}
          aria-pressed={active === c.key}
          className={cn(
            "rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50",
            active === c.key ? "border-primary ring-1 ring-primary/40" : "border-border",
          )}
        >
          <p className="truncate text-xs text-muted-foreground">{c.label}</p>
          <p className={cn("text-xl font-bold tabular-nums", TONES[c.tone || "default"])}>{c.value ?? "—"}</p>
        </button>
      ))}
    </div>
  );
}
