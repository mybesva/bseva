import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
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
import { adminPath } from "@/const";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const emptyForm = { name: "", email: "", phone: "", password: "", location: "" };

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const statusFilter = params.get("status") || "all";
  const [q, setQ] = useState(params.get("q") || "");

  function updateFilters(next: { status?: string; q?: string }) {
    const sp = new URLSearchParams();
    const st = next.status ?? statusFilter;
    const query = next.q ?? q;
    if (st && st !== "all") sp.set("status", st);
    if (query.trim()) sp.set("q", query.trim());
    const qs = sp.toString();
    setLocation(adminPath(`/customers${qs ? `?${qs}` : ""}`));
  }

  async function load() {
    const qs = new URLSearchParams({ role: "customer" });
    if (statusFilter === "blocked") qs.set("blocked", "true");
    if (statusFilter === "active") qs.set("blocked", "false");
    if (q.trim()) qs.set("q", q.trim());
    setRows(await api<any[]>(`/admin/users?${qs}`));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, [statusFilter, search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify({ ...form, role: "customer" }) });
      toast.success("Customer added");
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
        <h1 className="text-h1">Customers</h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus size={16} />
          Add customer
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="">Add customer</DialogTitle>
          </DialogHeader>
          <form id="add-customer-form" onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Name</Label>
              <Input
                id="customer-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-location">City / area</Label>
              <Input
                id="customer-location"
                placeholder="e.g. Jayanagar, Bangalore"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-password">Password</Label>
              <Input
                id="customer-password"
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
            <Button type="submit" form="add-customer-form" disabled={saving}>
              {saving ? "Adding…" : "Add customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Status filter</Label>
          <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Search name, email, phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q });
            }}
          />
          <Button type="button" onClick={() => updateFilters({ q })}>
            Search
          </Button>
        </div>
        {statusFilter !== "all" && (
          <Badge variant="secondary" className="mb-1">
            Showing: {statusFilter}
          </Badge>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.phone}</TableCell>
              <TableCell>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={u.preferred_language || "en"}
                  onChange={async (e) => {
                    const preferred_language = e.target.value;
                    try {
                      await api(`/admin/users/${u.id}/customer`, {
                        method: "PUT",
                        body: JSON.stringify({ preferred_language }),
                      });
                      toast.success("Language updated");
                      await load();
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="te">Telugu</option>
                </select>
              </TableCell>
              <TableCell>
                <Badge variant={u.blocked ? "destructive" : "secondary"}>{u.blocked ? "Blocked" : "Active"}</Badge>
              </TableCell>
              <TableCell className="space-x-2 whitespace-nowrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await api(`/admin/users/${u.id}/block`, {
                        method: "POST",
                        body: JSON.stringify({ blocked: !u.blocked, reason: u.blocked ? null : "Blocked by admin" }),
                      });
                      toast.success(u.blocked ? "Unblocked" : "Blocked");
                      await load();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
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
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4">No customers match this filter.</p>
      )}
    </AdminLayout>
  );
}
