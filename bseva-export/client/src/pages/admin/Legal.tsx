import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, Plus, Scale, Shield, Trash2, Ban } from "lucide-react";

type LegalPoint = { title: string; body: string };

type LegalPolicy = {
  id?: string;
  slug: string;
  title: string;
  version: string;
  sort_order?: number;
  points: LegalPoint[];
};

const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  platform_terms: Scale,
  booking_terms: FileText,
  cancellation_policy: Ban,
  privacy: Shield,
};

function PolicyEditor({
  policy,
  onSaved,
}: {
  policy: LegalPolicy;
  onSaved: (p: LegalPolicy) => void;
}) {
  const [title, setTitle] = useState(policy.title);
  const [version, setVersion] = useState(policy.version);
  const [points, setPoints] = useState<LegalPoint[]>(
    (policy.points || []).map((p) => ({ title: p.title || "", body: p.body || "" }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(policy.title);
    setVersion(policy.version);
    setPoints((policy.points || []).map((p) => ({ title: p.title || "", body: p.body || "" })));
  }, [policy]);

  const dirty = useMemo(() => {
    const sameTitle = title.trim() === (policy.title || "").trim();
    const sameVersion = version.trim() === (policy.version || "").trim();
    const samePoints =
      JSON.stringify(points.map((p) => ({ title: p.title.trim(), body: p.body.trim() }))) ===
      JSON.stringify(
        (policy.points || []).map((p) => ({ title: (p.title || "").trim(), body: (p.body || "").trim() }))
      );
    return !(sameTitle && sameVersion && samePoints);
  }, [title, version, points, policy]);

  function updatePoint(index: number, patch: Partial<LegalPoint>) {
    setPoints((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPoint() {
    setPoints((prev) => [...prev, { title: "", body: "" }]);
  }

  function removePoint(index: number) {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    const cleaned = points
      .map((p) => ({ title: p.title.trim(), body: p.body.trim() }))
      .filter((p) => p.body);
    if (!cleaned.length) {
      toast.error("Add at least one point with body text");
      return;
    }
    setSaving(true);
    try {
      const updated = await api<LegalPolicy>(`/admin/legal/${policy.slug}`, {
        method: "PUT",
        body: JSON.stringify({ title: title.trim(), version: version.trim(), points: cleaned }),
      });
      toast.success(`${updated.title} saved`);
      onSaved(updated);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="font-heading">{policy.title}</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Section title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Version</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2026-01" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {points.map((point, index) => (
          <div key={index} className="rounded-lg border border-border p-4 space-y-3 bg-background">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Point {index + 1}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive gap-1"
                onClick={() => removePoint(index)}
              >
                <Trash2 size={14} />
                Remove
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Point title (optional)</Label>
              <Input
                value={point.title}
                onChange={(e) => updatePoint(index, { title: e.target.value })}
                placeholder="e.g. Booking confirmation"
              />
            </div>
            <div className="space-y-1">
              <Label>Point text</Label>
              <Textarea
                value={point.body}
                onChange={(e) => updatePoint(index, { body: e.target.value })}
                rows={3}
                placeholder="Policy text for this point"
              />
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={addPoint}>
            <Plus size={16} />
            Add point
          </Button>
          {dirty && (
            <>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save section"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setTitle(policy.title);
                  setVersion(policy.version);
                  setPoints((policy.points || []).map((p) => ({ title: p.title || "", body: p.body || "" })));
                }}
              >
                Discard
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminLegalPage() {
  const [policies, setPolicies] = useState<LegalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await api<LegalPolicy[]>("/admin/legal");
      setPolicies(rows);
      setSelectedSlug((prev) => prev || rows[0]?.slug || null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = policies.find((p) => p.slug === selectedSlug) || null;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a section below. Only that section opens for edit — add, update, or remove points, then save.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading policies…</p>}

      {!loading && (
        <div className="max-w-4xl space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {policies.map((policy) => {
              const Icon = SECTION_ICONS[policy.slug] || FileText;
              const active = selectedSlug === policy.slug;
              return (
                <button
                  key={policy.slug}
                  type="button"
                  onClick={() => setSelectedSlug(policy.slug)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-xl border-2 p-4 text-center transition-colors",
                    active
                      ? "border-primary bg-orange-50 shadow-sm"
                      : "border-border bg-background hover:border-primary/40 hover:bg-secondary/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      active ? "bg-primary text-white" : "bg-secondary text-sidebar"
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  <span className={cn("text-sm font-medium leading-snug", active ? "text-sidebar" : "text-muted-foreground")}>
                    {policy.title}
                  </span>
                </button>
              );
            })}
          </div>

          {selected ? (
            <PolicyEditor
              key={selected.slug}
              policy={selected}
              onSaved={(updated) => {
                setPolicies((prev) => prev.map((p) => (p.slug === updated.slug ? { ...p, ...updated } : p)));
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Select a section to view and edit.</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
