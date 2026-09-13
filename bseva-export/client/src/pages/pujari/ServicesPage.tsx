import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OfferService = {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  catalog_price_paise: number;
  dakshina_paise: number;
  status: "none" | "pending" | "approved" | "rejected" | "pending_removal";
  selected: boolean;
  locked?: boolean;
  section_slugs?: string[];
  categories?: { slug?: string; name?: string }[];
};

type Section = { slug: string; name: string };

type OffersPayload = {
  share_percent: number;
  services: OfferService[];
  sections?: Section[];
  pending_count: number;
  approved_count: number;
  note?: string;
};

function statusBadge(status: OfferService["status"]) {
  switch (status) {
    case "approved":
      return <span className="text-xs font-medium text-emerald-700">Approved · locked</span>;
    case "pending":
      return <span className="text-xs font-medium text-amber-700">Pending approval · locked</span>;
    case "pending_removal":
      return <span className="text-xs font-medium text-amber-700">Removal pending</span>;
    case "rejected":
      return <span className="text-xs font-medium text-red-600">Rejected — you can request again</span>;
    default:
      return <span className="text-xs text-muted-foreground">Available to select</span>;
  }
}

export default function PujariServicesPage() {
  const [data, setData] = useState<OffersPayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [section, setSection] = useState("all");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const out = await api<OffersPayload>("/pujari/service-offers");
      setData(out);
      setSelected(new Set(out.services.filter((s) => s.selected || s.locked).map((s) => s.id)));
      setSection("all");
    } catch (e: any) {
      const msg = e?.message || "Could not load services";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sections = useMemo(() => {
    const fromApi = data?.sections || [{ slug: "all", name: "All" }];
    if (!fromApi.some((s) => s.slug === "all")) {
      return [{ slug: "all", name: "All" }, ...fromApi];
    }
    return fromApi;
  }, [data]);

  const filtered = useMemo(() => {
    const services = data?.services || [];
    const needle = q.trim().toLowerCase();
    return services.filter((s) => {
      if (section !== "all") {
        const slugs = s.section_slugs || [];
        if (!slugs.includes(section)) return false;
      }
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        (s.short_description || "").toLowerCase().includes(needle) ||
        (s.slug || "").toLowerCase().includes(needle)
      );
    });
  }, [data, q, section]);

  const grouped = useMemo(() => {
    if (section !== "all") {
      const title = sections.find((s) => s.slug === section)?.name || section;
      return [{ slug: section, name: title, items: filtered }];
    }
    const bySlug = new Map<string, { slug: string; name: string; items: OfferService[] }>();
    const uncategorized: OfferService[] = [];
    for (const s of filtered) {
      const cats = s.categories || [];
      if (!cats.length) {
        uncategorized.push(s);
        continue;
      }
      for (const c of cats) {
        const slug = c.slug || "other";
        const name = c.name || slug;
        if (!bySlug.has(slug)) bySlug.set(slug, { slug, name, items: [] });
        const bucket = bySlug.get(slug)!;
        if (!bucket.items.some((x) => x.id === s.id)) bucket.items.push(s);
      }
    }
    const ordered: { slug: string; name: string; items: OfferService[] }[] = [];
    for (const sec of sections) {
      if (sec.slug === "all") continue;
      const bucket = bySlug.get(sec.slug);
      if (bucket?.items.length) ordered.push(bucket);
      bySlug.delete(sec.slug);
    }
    for (const bucket of bySlug.values()) {
      if (bucket.items.length) ordered.push(bucket);
    }
    if (uncategorized.length) {
      ordered.push({ slug: "uncategorized", name: "Other pujas", items: uncategorized });
    }
    return ordered.length ? ordered : [{ slug: "all", name: "All pujas", items: filtered }];
  }, [filtered, section, sections]);

  const lockedIds = useMemo(
    () => new Set((data?.services || []).filter((s) => s.locked).map((s) => s.id)),
    [data]
  );

  const newSelectionCount = useMemo(() => {
    let n = 0;
    for (const id of selected) {
      if (!lockedIds.has(id)) n += 1;
    }
    return n;
  }, [selected, lockedIds]);

  function toggle(id: string, on: boolean) {
    if (lockedIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    if (newSelectionCount === 0) {
      toast.message("Select at least one new puja to submit");
      return;
    }
    setSaving(true);
    try {
      const out = await api<OffersPayload>("/pujari/service-offers", {
        method: "PUT",
        body: JSON.stringify({ service_ids: Array.from(selected) }),
      });
      setData(out);
      setSelected(new Set(out.services.filter((s) => s.selected || s.locked).map((s) => s.id)));
      toast.success(
        out.pending_count > 0
          ? "Submitted for admin approval — selected pujas are locked until Admin decides"
          : "Saved"
      );
    } catch (err: any) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <PujariPortal>
        <p className="text-muted-foreground">Loading services…</p>
      </PujariPortal>
    );
  }

  if (loadError && !data) {
    return (
      <PujariPortal>
        <Card className="max-w-lg border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Could not load services</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </PujariPortal>
    );
  }

  if (!data) {
    return (
      <PujariPortal>
        <p className="text-muted-foreground">Loading services…</p>
      </PujariPortal>
    );
  }

  return (
    <PujariPortal>
      <div className="w-full max-w-none space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Services &amp; Dakshina</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {data.note ||
              "All BSeva catalog pujas are listed by section. Select new ones and submit for approval. Locked selections cannot be edited — only Admin can remove access."}
          </p>
          <p className="text-sm text-muted-foreground">
            Dakshina shown is the estimated amount for the standard package.{" "}
            <span className="font-medium text-foreground">
              Catalog: {data.services.length} · Approved: {data.approved_count} · Pending:{" "}
              {data.pending_count}
            </span>
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all pujas…"
            className="max-w-md bg-background"
          />
          <Button type="button" disabled={saving || newSelectionCount === 0} onClick={() => void save()}>
            {saving
              ? "Submitting…"
              : newSelectionCount > 0
                ? `Submit ${newSelectionCount} new puja${newSelectionCount === 1 ? "" : "s"} for approval`
                : "Select new pujas to submit"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {sections.map((sec) => (
            <Button
              key={sec.slug}
              type="button"
              size="sm"
              variant={section === sec.slug ? "default" : "outline"}
              onClick={() => setSection(sec.slug)}
            >
              {sec.name}
            </Button>
          ))}
        </div>

        <div className="space-y-8 pb-8">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No services match your filters.</p>
          ) : (
            grouped.map((group) => (
              <section key={group.slug} className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  {group.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({group.items.length})</span>
                </h2>
                <div className="divide-y rounded-md border border-border bg-background/80">
                  {group.items.map((s) => {
                    const locked = !!s.locked;
                    const checked = selected.has(s.id) || locked;
                    return (
                      <label
                        key={`${group.slug}-${s.id}`}
                        className={cn(
                          "flex items-start gap-3 p-4",
                          locked
                            ? "bg-muted/30 cursor-not-allowed opacity-90"
                            : "hover:bg-muted/40 cursor-pointer"
                        )}
                      >
                        <Checkbox
                          className="mt-1"
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={(v) => toggle(s.id, !!v)}
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-sm font-semibold text-primary">
                              Dakshina {rupees(s.dakshina_paise)}
                            </p>
                          </div>
                          {s.short_description ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">{s.short_description}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Catalog {rupees(s.catalog_price_paise)}</span>
                            {statusBadge(s.status)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </PujariPortal>
  );
}
