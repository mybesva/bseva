import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api, rupees } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  required_level: 2,
  standard_price_paise: 250000,
  premium_price_paise: 450000,
  duration_minutes: 90,
  virtual_available: false,
  active: true,
};

export default function ServicesAdmin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isSuper = user?.role === "super_admin";
  const { config: publicConfig } = usePublicConfig();
  const virtualFlagOn = Boolean(publicConfig.virtual_puja_enabled);

  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [linked, setLinked] = useState<any[]>([]);
  const [linkItemId, setLinkItemId] = useState("");

  async function load() {
    setRows(await api<any[]>("/admin/services"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    api<any[]>("/samagri/items")
      .then(setSamagriItems)
      .catch(() => setSamagriItems([]));
  }, []);

  async function loadLinked(serviceId: string) {
    try {
      setLinked(await api<any[]>(`/services/${serviceId}/samagri`));
    } catch {
      setLinked([]);
    }
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm, virtual_available: virtualFlagOn });
    setLinked([]);
    setOpen(true);
  }

  function openEdit(s: any) {
    setEditId(s.id);
    setForm({
      name: s.name || "",
      slug: s.slug || "",
      description: s.description || "",
      required_level: s.required_level || 2,
      standard_price_paise: Number(s.standard_price_paise) || 0,
      premium_price_paise: Number(s.premium_price_paise) || 0,
      duration_minutes: s.duration_minutes || 90,
      virtual_available: s.virtual_available !== false,
      active: s.active !== false,
    });
    void loadLinked(s.id);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const slug =
        form.slug ||
        form.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      const payload = {
        ...form,
        slug,
        standard_price_paise: Math.max(0, Math.round(Number(form.standard_price_paise) || 0)),
        premium_price_paise: Math.max(0, Math.round(Number(form.premium_price_paise) || 0)),
        duration_minutes: Math.max(15, Math.round(Number(form.duration_minutes) || 90)),
        required_level: Math.min(4, Math.max(1, Number(form.required_level) || 2)),
        // Keep virtual off per-service while platform flag is disabled
        virtual_available: virtualFlagOn ? form.virtual_available : false,
      };
      if (editId) {
        await api(`/admin/services/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast.success("Service & pricing updated");
      } else {
        await api("/admin/services", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Service added");
      }
      setForm(emptyForm);
      setEditId(null);
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Puja Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit each puja’s name, description, duration, and Standard / Premium pricing.
            {isSuper ? " As Super Admin you can change all services and costs." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLocation("/admin/pricing")}>
            Location & surge pricing
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} />
            Add service
          </Button>
        </div>
      </div>

      {!virtualFlagOn && isSuper && (
        <p className="text-sm text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2">
          Virtual Puja is currently off. Enable it under{" "}
          <Link href="/admin/settings" className="text-primary underline-offset-2 hover:underline">
            Settings → Virtual Puja
          </Link>
          .
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Edit puja service" : "Add puja service"}</DialogTitle>
          </DialogHeader>
          <form id="add-service-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Puja / service name</Label>
              <Input
                id="service-name"
                placeholder="e.g. Satyanarayan Puja"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-slug">Slug (URL)</Label>
              <Input
                id="service-slug"
                placeholder="Optional — auto-generated from name"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                placeholder="Short description of the service"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium">Cost & pricing</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-standard">Standard price (₹)</Label>
                  <Input
                    id="service-standard"
                    type="number"
                    min={0}
                    step={1}
                    value={form.standard_price_paise / 100}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        standard_price_paise: Math.round(Number(e.target.value || 0) * 100),
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-premium">Premium price (₹)</Label>
                  <Input
                    id="service-premium"
                    type="number"
                    min={0}
                    step={1}
                    value={form.premium_price_paise / 100}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        premium_price_paise: Math.round(Number(e.target.value || 0) * 100),
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-level">Required pujari level</Label>
                <Select
                  value={String(form.required_level)}
                  onValueChange={(v) => setForm({ ...form, required_level: Number(v) })}
                >
                  <SelectTrigger id="service-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-duration">Duration (minutes)</Label>
                <Input
                  id="service-duration"
                  type="number"
                  min={15}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {virtualFlagOn && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.virtual_available}
                    onChange={(e) => setForm({ ...form, virtual_available: e.target.checked })}
                  />
                  Virtual available for this puja
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active (shown to customers)
              </label>
            </div>
            {editId && (
              <div className="space-y-2 border-t pt-3">
                <Label>Recommended List (samagri) for this service</Label>
                <ul className="text-sm space-y-1 max-h-28 overflow-y-auto">
                  {linked.map((it) => (
                    <li key={it.samagri_item_id || it.id}>
                      {it.name}
                      {it.required ? " (required)" : ""}
                    </li>
                  ))}
                  {linked.length === 0 && <li className="text-muted-foreground">None linked yet</li>}
                </ul>
                <div className="flex gap-2 flex-wrap">
                  <Select value={linkItemId} onValueChange={setLinkItemId}>
                    <SelectTrigger className="flex-1 min-w-[10rem]">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {samagriItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      if (!editId || !linkItemId) return;
                      try {
                        await api(`/admin/services/${editId}/samagri`, {
                          method: "POST",
                          body: JSON.stringify({
                            samagri_item_id: linkItemId,
                            required: true,
                            optional: false,
                            customer_provided: true,
                            sort_order: linked.length,
                          }),
                        });
                        toast.success("Item linked");
                        await loadLinked(editId);
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    Link item
                  </Button>
                </div>
              </div>
            )}
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-service-form" disabled={saving}>
              {saving ? "Saving…" : editId ? "Save changes" : "Add service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Standard</TableHead>
            <TableHead>Premium</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{s.slug}</TableCell>
              <TableCell>{s.required_level}</TableCell>
              <TableCell>{rupees(s.standard_price_paise)}</TableCell>
              <TableCell>{rupees(s.premium_price_paise)}</TableCell>
              <TableCell>{s.duration_minutes} min</TableCell>
              <TableCell>
                <Badge variant={s.active ? "default" : "secondary"}>{s.active ? "active" : "inactive"}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(s)}>
                    <Pencil size={14} />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Remove ${s.name}?`)) return;
                      try {
                        const out = await api<{ deactivated?: boolean }>(`/admin/services/${s.id}`, {
                          method: "DELETE",
                        });
                        toast.success(out.deactivated ? "Hidden (has bookings)" : "Deleted");
                        await load();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No services yet. Add your first puja service.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AdminLayout>
  );
}
