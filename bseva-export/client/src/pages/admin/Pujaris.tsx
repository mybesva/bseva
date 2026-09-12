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
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { adminPath } from "@/const";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const emptyForm = { name: "", email: "", phone: "", password: "", requested_level: 2, location: "" };

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

function PujariRow({ u, levels, onChanged }: { u: any; levels: { level: number; title: string }[]; onChanged: () => Promise<void> }) {
  const [, setLocation] = useLocation();
  const [level, setLevel] = useState(Number(u.approved_level || u.requested_level || 1));
  const [saving, setSaving] = useState(false);
  const specializations = parseList(u.specializations);

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
      <TableCell>
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          onClick={() => setLocation(adminPath(`/pujaris/${u.id}`))}
        >
          {u.name}
        </button>
        <div className="text-xs text-muted-foreground mt-0.5">
          {u.profile_completion_percentage != null ? `${u.profile_completion_percentage}% profile` : ""}
        </div>
      </TableCell>
      <TableCell>{u.email}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-2 min-w-[220px]">
          <span className="text-xs text-muted-foreground">Requested: {u.requested_level ??"—"}</span>
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
      <TableCell>
        <div className="min-w-[160px] space-y-1">
          <span className="text-sm">
            {u.experience_years == null || u.experience_years === "" ? "—" : `${u.experience_years} yrs`}
          </span>
          {specializations.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {specializations.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">
                  {s}
                </Badge>
              ))}
              {specializations.length > 3 && (
                <span className="text-xs text-muted-foreground">+{specializations.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell><Badge>{u.verification_status}</Badge></TableCell>
      <TableCell><Badge variant={u.blocked ? "destructive" : "secondary"}>{u.blocked ? "Blocked" : "Active"}</Badge></TableCell>
      <TableCell className="space-x-2 whitespace-nowrap">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setLocation(adminPath(`/pujaris/${u.id}`))}
        >
          Profile
        </Button>
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
          variant="outline"
          onClick={async () => {
            if (!confirm(`Suspend (block) ${u.name}? Prefer this over permanent delete.`)) return;
            try {
              await api(`/admin/users/${u.id}/block`, {
                method: "POST",
                body: JSON.stringify({ blocked: true, reason: "Admin suspended account" }),
              });
              toast.success("Account suspended (blocked)");
              await onChanged();
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        >
          Suspend
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function PujarisPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { levels: pujariLevels } = usePujariLevels();
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
    setLocation(adminPath(`/pujaris${qs ? `?${qs}` : ""}`));
  }

  async function load(p = page) {
    const qs = new URLSearchParams({ page: String(p), page_size: "50" });
    if (statusFilter && statusFilter !== "all") qs.set("status", statusFilter);
    if (q.trim()) qs.set("q", q.trim());
    const res = await api<{ items: any[]; total: number; page: number; pages: number } | any[]>(`/admin/pujaris?${qs}`);
    if (Array.isArray(res)) {
      setRows(res);
      setTotal(res.length);
      setPage(1);
      setPages(1);
    } else {
      setRows(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
      setPages(res.pages || 1);
    }
  }

  useEffect(() => {
    void load(1).catch((e) => toast.error(e.message));
  }, [statusFilter, search]);

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
        <h1 className="text-h1">Pujaris</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page}/{pages} · {total}
          </span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => void load(page + 1)}>
            Next
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus size={16} />
            Add pujari
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Status filter</Label>
          <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v })}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending verification</SelectItem>
              <SelectItem value="correction_required">Correction required</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
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
          <Button type="button" variant="secondary" onClick={() => updateFilters({ q })}>
            Search
          </Button>
        </div>
        {statusFilter !== "all" && (
          <Badge variant="secondary" className="mb-1">
            Showing: {statusFilter.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="">Add pujari</DialogTitle>
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
            <TableHead>Experience</TableHead>
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
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4">No pujaris match this filter.</p>
      )}
    </AdminLayout>
  );
}
