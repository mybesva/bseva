import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export function SortableHead({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: SortDir;
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sortBy === column;
  return (
    <TableHead
      className={cn("sticky top-0 z-20 bg-card border-b border-border", className)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold hover:text-primary"
        onClick={() => onSort(column)}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function StaticHead({ label, className }: { label?: string; className?: string }) {
  return (
    <TableHead className={cn("sticky top-0 z-20 bg-card border-b border-border", className)}>
      {label}
    </TableHead>
  );
}

export function nextSort(currentBy: string, currentDir: SortDir, column: string): { sort: string; dir: SortDir } {
  if (currentBy === column) return { sort: column, dir: currentDir === "asc" ? "desc" : "asc" };
  return { sort: column, dir: "asc" };
}

export function personLocation(u: { location?: string; location_label?: string; city?: string; district?: string }) {
  const raw = [u.location, u.location_label, u.city, u.district]
    .map((s) => String(s || "").trim())
    .find(Boolean);
  return raw || "—";
}
