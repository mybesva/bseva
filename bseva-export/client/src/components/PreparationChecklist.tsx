import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export type PrepItem = {
  name?: string;
  label?: string;
  quantity?: number | null;
  unit?: string | null;
  optional?: boolean;
  required?: boolean;
  notes?: string | null;
  section?: string;
};

export type PreparationView = {
  verified?: boolean;
  pending_message?: string | null;
  preparation_notes?: string | null;
  special_instructions?: string | null;
  prasadam_notes?: string | null;
  venue_notes?: string | null;
  disclaimer?: string | null;
  display_name?: string | null;
  samagri_purchased?: boolean;
  sections?: Record<string, PrepItem[]>;
  items?: PrepItem[];
};

const SECTION_META: { key: string; title: string }[] = [
  { key: "included_bseva", title: "Included with your Samagri package" },
  { key: "customer_arrange", title: "Please arrange" },
  { key: "prasadam", title: "Prasadam / Naivedyam" },
  { key: "home_venue", title: "Home / venue setup" },
  { key: "optional", title: "Optional" },
];

function itemLabel(it: PrepItem): string {
  if (it.label) return it.label;
  if (it.name && it.quantity != null) {
    return `${it.name} — ${it.quantity}${it.unit ? ` ${it.unit}` : ""}`;
  }
  return it.name || "Item";
}

export default function PreparationChecklist({
  preparation,
  title = "Puja preparation & Samagri",
  interactive = true,
  compact = false,
}: {
  preparation?: PreparationView | null;
  title?: string;
  interactive?: boolean;
  compact?: boolean;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    if (!preparation?.verified) return [];
    const src = preparation.sections || {};
    return SECTION_META.map((s) => ({
      ...s,
      items: src[s.key] || [],
    })).filter((s) => s.items.length > 0);
  }, [preparation]);

  if (!preparation) return null;

  if (!preparation.verified) {
    return (
      <div className={compact ?"space-y-1" :"rounded-lg border p-4 space-y-2"}>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {preparation.pending_message || "Your detailed Samagri checklist will be confirmed shortly."}
        </p>
        {preparation.disclaimer && (
          <p className="text-xs text-muted-foreground">{preparation.disclaimer}</p>
        )}
      </div>
    );
  }

  return (
    <div className={compact ?"space-y-3" :"rounded-lg border p-4 space-y-4"}>
      <div>
        <h3 className="font-semibold">{title}</h3>
        {preparation.display_name && (
          <p className="text-sm text-muted-foreground">{preparation.display_name}</p>
        )}
      </div>

      {(preparation.preparation_notes || preparation.special_instructions) && (
        <div className="text-sm space-y-1">
          {preparation.preparation_notes && <p>{preparation.preparation_notes}</p>}
          {preparation.special_instructions && (
            <p className="text-muted-foreground">{preparation.special_instructions}</p>
          )}
        </div>
      )}

      {sections.map((sec) => (
        <div key={sec.key} className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{sec.title}</h4>
          <ul className="space-y-2">
            {sec.items.map((it, i) => {
              const key = `${sec.key}-${i}-${it.name || itemLabel(it)}`;
              const label = itemLabel(it);
              return (
                <li key={key} className="flex gap-2 items-start text-sm">
                  {interactive ? (
                    <Checkbox
                      checked={!!checked[key]}
                      onCheckedChange={(v) =>
                        setChecked((prev) => ({ ...prev, [key]: !!v }))
                      }
                      className="mt-0.5"
                    />
                  ) : (
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  )}
                  <div>
                    <div>
                      {label}
                      {it.optional ? (
                        <span className="text-muted-foreground"> (optional)</span>
                      ) : null}
                    </div>
                    {it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
          {sec.key === "prasadam" && preparation.prasadam_notes && (
            <p className="text-xs text-muted-foreground">{preparation.prasadam_notes}</p>
          )}
          {sec.key === "home_venue" && preparation.venue_notes && (
            <p className="text-xs text-muted-foreground">{preparation.venue_notes}</p>
          )}
        </div>
      ))}

      {preparation.disclaimer && (
        <p className="text-xs text-muted-foreground border-t pt-2">{preparation.disclaimer}</p>
      )}
    </div>
  );
}
