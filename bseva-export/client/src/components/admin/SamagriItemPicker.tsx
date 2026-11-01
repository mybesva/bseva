import { Check, ChevronsUpDown } from "lucide-react";
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

type SamagriItem = { id: string; name: string; unit?: string | null };

export function SamagriItemPicker({
  items,
  addedIds,
  value,
  onChange,
  onOpen,
}: {
  items: SamagriItem[];
  /** Items already on this puja; picking one edits it. */
  addedIds: string[];
  value: string;
  onChange: (id: string) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = items.find((it) => it.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpen?.();
        else setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected?.name || "Search or select an item"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search samagri items" value={query} onValueChange={setQuery} className="h-10" />
          <CommandList className="max-h-60">
            <CommandEmpty>No item found. Add it in the Samagri tab first.</CommandEmpty>
            <CommandGroup>
              {filtered.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.id}
                  onSelect={() => {
                    onChange(it.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate">{it.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {addedIds.includes(it.id) ? <span className="font-medium text-primary">Added</span> : null}
                    {it.unit ? <span>{it.unit}</span> : null}
                    <Check className={cn("size-4", value === it.id ? "opacity-100" : "opacity-0")} />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
