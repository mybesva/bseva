import {
  filterHeadRatingPujaris,
  formatIndianPhone,
  headRatingPujariSubtitle,
  type HeadRatingPujari,
} from "@bseva/config";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PujariSearchSelectProps = {
  pujaris: HeadRatingPujari[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PujariSearchSelect({ pujaris, value, onChange, loading, disabled }: PujariSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = pujaris.find((p) => p.id === value);
  const filtered = useMemo(() => filterHeadRatingPujaris(pujaris, query), [pujaris, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className="h-11 w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {loading ? "Loading pujaris…" : selected?.name || "Choose a pujari"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search pujari by name, email or phone"
              value={query}
              onValueChange={setQuery}
              className="h-11"
            />
          </div>
          <CommandList>
            <CommandEmpty>No pujaris found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex flex-col items-start gap-0.5 py-2.5"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Check className={cn("size-4 shrink-0", value === p.id ? "opacity-100" : "opacity-0")} />
                  </div>
                  <span className="text-xs text-muted-foreground">{headRatingPujariSubtitle(p)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SelectedPujariCard({
  pujari,
  onChange,
}: {
  pujari: HeadRatingPujari;
  onChange: () => void;
}) {
  const phone = formatIndianPhone(pujari.phone);
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <Check className="size-4 shrink-0 text-primary" />
            <span className="truncate">{pujari.name}</span>
          </p>
          {phone !== "—" ? <p className="text-sm text-muted-foreground">{phone}</p> : null}
          {pujari.email ? <p className="truncate text-sm text-muted-foreground">{pujari.email}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-primary" onClick={onChange}>
          Change
        </Button>
      </div>
    </div>
  );
}
