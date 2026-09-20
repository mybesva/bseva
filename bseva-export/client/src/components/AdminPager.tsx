import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const BOOKING_PAGE_SIZES = [50, 100, 150, 200] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_BOOKING_PAGE_SIZE = 50;

export function parsePageSize(
  raw: string | null | undefined,
  allowed: readonly number[] = PAGE_SIZES,
  fallback = DEFAULT_PAGE_SIZE,
) {
  const n = Number(raw);
  return allowed.includes(n) ? n : fallback;
}

export function parsePage(raw: string | null | undefined) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function AdminPager({
  page,
  pages,
  total,
  pageSize,
  onPage,
  onPageSize,
  sizes = PAGE_SIZES,
  sizeLabel = "IDs / page",
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  sizes?: readonly number[];
  sizeLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Page {page}/{pages} · {total}
      </span>
      <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
        <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizes.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} {sizeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </Button>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}
