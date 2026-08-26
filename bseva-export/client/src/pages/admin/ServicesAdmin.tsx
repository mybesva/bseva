import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Plus } from "lucide-react";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  required_level: 2,
  standard_price_paise: 250000,
  premium_price_paise: 450000,
  duration_minutes: 90,
};

export default function ServicesAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setRows(await api<any[]>("/admin/services"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await api("/admin/services", {
        method: "POST",
        body: JSON.stringify({ ...form, slug, virtual_available: true, active: true }),
      });
      toast.success("Service added");
      setForm(emptyForm);
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-heading font-bold">Services</h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus size={16} />
          Add service
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Add service</DialogTitle>
          </DialogHeader>
          <form id="add-service-form" onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Name</Label>
              <Input
                id="service-name"
                placeholder="e.g. Satyanarayan Puja"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-slug">Slug</Label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-standard">Standard price (₹)</Label>
                <Input
                  id="service-standard"
                  type="number"
                  min={0}
                  value={form.standard_price_paise / 100}
                  onChange={(e) => setForm({ ...form, standard_price_paise: Math.round(Number(e.target.value) * 100) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-premium">Premium price (₹)</Label>
                <Input
                  id="service-premium"
                  type="number"
                  min={0}
                  value={form.premium_price_paise / 100}
                  onChange={(e) => setForm({ ...form, premium_price_paise: Math.round(Number(e.target.value) * 100) })}
                  required
                />
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
                  min={30}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-service-form" disabled={saving}>
              {saving ? "Adding…" : "Add service"}
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
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.name}</TableCell>
              <TableCell>{s.slug}</TableCell>
              <TableCell>{s.required_level}</TableCell>
              <TableCell>{rupees(s.standard_price_paise)}</TableCell>
              <TableCell>{rupees(s.premium_price_paise)}</TableCell>
              <TableCell>
                <Badge>{s.active ? "active" : "inactive"}</Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm(`Remove ${s.name}?`)) return;
                    try {
                      const out = await api<{ deactivated?: boolean }>(`/admin/services/${s.id}`, { method: "DELETE" });
                      toast.success(out.deactivated ? "Hidden (has bookings)" : "Deleted");
                      await load();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminLayout>
  );
}
