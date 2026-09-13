import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";

type OfferService = {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  catalog_price_paise: number;
  dakshina_paise: number;
  status: "none" | "pending" | "approved" | "rejected" | "pending_removal";
  selected: boolean;
};

type OffersPayload = {
  share_percent: number;
  services: OfferService[];
  pending_count: number;
  approved_count: number;
  note?: string;
};

function statusBadge(status: OfferService["status"]) {
  switch (status) {
    case "approved":
      return <span className="text-xs font-medium text-emerald-700">Approved</span>;
    case "pending":
      return <span className="text-xs font-medium text-amber-700">Pending admin approval</span>;
    case "pending_removal":
      return <span className="text-xs font-medium text-amber-700">Removal pending approval</span>;
    case "rejected":
      return <span className="text-xs font-medium text-red-600">Rejected</span>;
    default:
      return <span className="text-xs text-muted-foreground">Not selected</span>;
  }
}

export default function PujariServicesPage() {
  const [data, setData] = useState<OffersPayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const out = await api<OffersPayload>("/pujari/service-offers");
      setData(out);
      setSelected(new Set(out.services.filter((s) => s.selected).map((s) => s.id)));
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

  const filtered = useMemo(() => {
    const services = data?.services || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.short_description || "").toLowerCase().includes(needle) ||
        (s.slug || "").toLowerCase().includes(needle)
    );
  }, [data, q]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const out = await api<OffersPayload>("/pujari/service-offers", {
        method: "PUT",
        body: JSON.stringify({ service_ids: Array.from(selected) }),
      });
      setData(out);
      setSelected(new Set(out.services.filter((s) => s.selected).map((s) => s.id)));
      toast.success(
        out.pending_count > 0
          ? "Submitted for admin approval — services stay pending until approved"
          : "No pending changes"
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
      <Card className="max-w-3xl border-border shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Services &amp; Dakshina</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Choose from BSeva catalog pujas you can perform. New selections and changes need Admin approval before they
            go live. You cannot add custom pujas here.
          </CardDescription>
          <p className="text-sm text-muted-foreground">
            Dakshina shown is the estimated amount for the standard package.{" "}
            <span className="font-medium text-foreground">
              Approved: {data.approved_count} · Pending: {data.pending_count}
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services…"
            className="max-w-md"
          />
          <div className="divide-y rounded-md border max-h-[28rem] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No services match your search.</p>
            ) : (
              filtered.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      className="mt-1"
                      checked={checked}
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
              })
            )}
          </div>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Submitting…" : "Submit for approval"}
          </Button>
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
