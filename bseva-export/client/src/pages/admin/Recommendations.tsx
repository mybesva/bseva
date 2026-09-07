import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ANY_MONTH = "any";

const emptyForm = {
  service_id: "",
  title: "",
  description: "",
  audience: "customer",
  month_number: ANY_MONTH,
  recurrence_hint: "",
  active: true,
  sort_order: 0,
};

export default function RecommendationsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setRows(await api<any[]>("/admin/recommendations"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    api<any[]>("/admin/services")
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(r: any) {
    setEditId(r.id);
    setForm({
      service_id: String(r.service_id || ""),
      title: r.title || "",
      description: r.description || "",
      audience: r.audience || "customer",
      month_number: r.month_number ? String(r.month_number) : ANY_MONTH,
      recurrence_hint: r.recurrence_hint || "",
      active: r.active !== false,
      sort_order: Number(r.sort_order) || 0,
    });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.service_id) {
      toast.error("Pick a service to recommend");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        service_id: form.service_id,
        title: form.title,
        description: form.description || null,
        audience: form.audience || "customer",
        month_number: form.month_number === ANY_MONTH ? null : Number(form.month_number),
        recurrence_hint: form.recurrence_hint || null,
        active: form.active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editId) {
        await api(`/admin/recommendations/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast.success("Recommendation updated");
      } else {
        await api("/admin/recommendations", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Recommendation added");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: any) {
    if (!confirm(`Remove "${r.title}"?`)) return;
    try {
      await api(`/admin/recommendations/${r.id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-h1">Recommended pujas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suggestions shown to customers on their dashboard. Pick a month to make one seasonal, or leave it on
            “Any month” to show it all year.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} />
          Add recommendation
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="">
              {editId ? "Edit recommendation" : "Add recommendation"}
            </DialogTitle>
          </DialogHeader>
          <form id="recommendation-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rec-service">Service</Label>
              <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                <SelectTrigger id="rec-service">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-title">Title</Label>
              <Input
                id="rec-title"
                placeholder="e.g. Shravan Satyanarayan Puja"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                minLength={2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-description">Description</Label>
              <Textarea
                id="rec-description"
                placeholder="Why this puja is recommended now"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rec-month">Month</Label>
                <Select
                  value={form.month_number}
                  onValueChange={(v) => setForm({ ...form, month_number: v })}
                >
                  <SelectTrigger id="rec-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_MONTH}>Any month</SelectItem>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-order">Sort order</Label>
                <Input
                  id="rec-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-recurrence">Recurrence hint</Label>
              <Input
                id="rec-recurrence"
                placeholder="e.g. Every Purnima"
                value={form.recurrence_hint}
                onChange={(e) => setForm({ ...form, recurrence_hint: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active (shown to customers)
            </label>
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="recommendation-form" disabled={saving}>
              {saving ? "Saving…" : editId ? "Save changes" : "Add recommendation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.title}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{r.service_name}</TableCell>
              <TableCell>{r.month_number ? MONTHS[r.month_number - 1] : "Any"}</TableCell>
              <TableCell>{r.sort_order}</TableCell>
              <TableCell>
                <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "active" : "inactive"}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(r)}>
                    <Pencil size={14} />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(r)}>
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No recommendations yet. Add one to surface it on customer dashboards.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AdminLayout>
  );
}
