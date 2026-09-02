import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const emptyForm = { name: "", email: "", phone: "", password: "", requested_level: 2, location: "" };

function PujariRow({ u, levels, onChanged }: { u: any; levels: { level: number; title: string }[]; onChanged: () => Promise<void> }) {
  const [level, setLevel] = useState(Number(u.approved_level || u.requested_level || 1));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLevel(Number(u.approved_level || u.requested_level || 1));
  }, [u.approved_level, u.requested_level]);

  async function saveLevel() {
    setSaving(true);
    try {
      await api(`/admin/pujaris/${u.id}/level`, {
        method: "POST",
        body: JSON.stringify({ approved_level: level }),
      });
      toast.success(`${u.name}: approved level ${level}`);
      await onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell>{u.name}</TableCell>
      <TableCell>{u.email}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-2 min-w-[220px]">
          <span className="text-xs text-muted-foreground">Requested: {u.requested_level ?? "—"}</span>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {levels.map((l) => (
                <option key={l.level} value={l.level}>
                  Level {l.level} — {l.title}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" disabled={saving || level === Number(u.approved_level)} onClick={saveLevel}>
              Save level
            </Button>
          </div>
        </div>
      </TableCell>
      <TableCell><Badge>{u.verification_status}</Badge></TableCell>
      <TableCell><Badge variant={u.blocked ? "destructive" : "secondary"}>{u.blocked ? "Blocked" : "Active"}</Badge></TableCell>
      <TableCell className="space-x-2 whitespace-nowrap">
        <Button
          size="sm"
          onClick={async () => {
            await api(`/admin/pujaris/${u.id}/verify`, {
              method: "POST",
              body: JSON.stringify({ verification_status: "approved", approved_level: level }),
            });
            toast.success("Approved");
            await onChanged();
          }}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await api(`/admin/pujaris/${u.id}/verify`, {
              method: "POST",
              body: JSON.stringify({ verification_status: "correction_required", approved_level: level }),
            });
            toast.success("Marked correction required");
            await onChanged();
          }}
        >
          Correction
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await api(`/admin/pujaris/${u.id}/verify`, {
              method: "POST",
              body: JSON.stringify({ verification_status: "rejected", approved_level: level }),
            });
            toast.success("Rejected");
            await onChanged();
          }}
        >
          Reject
        </Button>
        {u.is_head_pujari || u.role === "head_pujari" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await api(`/admin/pujaris/${u.id}/head`, {
                method: "POST",
                body: JSON.stringify({ is_head_pujari: false, scope_cities: [] }),
              });
              toast.success("Removed Head Pujari");
              await onChanged();
            }}
          >
            Unhead
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await api(`/admin/pujaris/${u.id}/head`, {
                method: "POST",
                body: JSON.stringify({ is_head_pujari: true, scope_cities: [] }),
              });
              toast.success("Marked Head Pujari");
              await onChanged();
            }}
          >
            Make Head
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await api(`/admin/users/${u.id}/block`, { method: "POST", body: JSON.stringify({ blocked: !u.blocked, reason: "Admin action" }) });
            await onChanged();
          }}
        >
          {u.blocked ? "Unblock" : "Block"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={async () => {
            if (!confirm(`Delete ${u.name}?`)) return;
            try {
              await api(`/admin/users/${u.id}`, { method: "DELETE" });
              toast.success("Deleted");
              await onChanged();
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function PujarisPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { levels: pujariLevels } = usePujariLevels();

  async function load() {
    setRows(await api<any[]>("/admin/pujaris"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...form, role: "pujari" }),
      });
      toast.success("Pujari added");
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
        <h1 className="text-2xl font-heading font-bold">Pujaris</h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus size={16} />
          Add pujari
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add pujari</DialogTitle>
          </DialogHeader>
          <form id="add-pujari-form" onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pujari-name">Name</Label>
              <Input
                id="pujari-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pujari-email">Email</Label>
              <Input
                id="pujari-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pujari-phone">Phone</Label>
              <Input
                id="pujari-phone"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pujari-location">City / area</Label>
              <Input
                id="pujari-location"
                placeholder="e.g. Jayanagar, Bangalore"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pujari-level">Level</Label>
              <Select
                value={String(form.requested_level)}
                onValueChange={(v) => setForm({ ...form, requested_level: Number(v) })}
              >
                <SelectTrigger id="pujari-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pujariLevels.map((l) => (
                    <SelectItem key={l.level} value={String(l.level)}>
                      Level {l.level} — {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pujari-password">Password</Label>
              <Input
                id="pujari-password"
                type="password"
                placeholder="Temporary login password (min 8 characters)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required
              />
            </div>
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-pujari-form" disabled={saving}>
              {saving ? "Adding…" : "Add pujari"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Account</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <PujariRow key={u.id} u={u} levels={pujariLevels} onChanged={load} />
          ))}
        </TableBody>
      </Table>
    </AdminLayout>
  );
}
