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
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { adminPath } from "@/const";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { nextSort, personLocation, SortableHead, StaticHead, type SortDir } from "@/components/SortableHead";
import { PREFERRED_LANGUAGES } from "@/lib/languages";
import { AdminPager, DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/components/AdminPager";

const emptyForm = { name: "", email: "", phone: "", password: "", location: "" };

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const statusFilter = params.get("status") || "all";
  const sortBy = params.get("sort") || "created_at";
  const sortDir = (params.get("dir") === "asc" ? "asc" : "desc") as SortDir;
  const pageSize = parsePageSize(params.get("size"));
  const urlPage = parsePage(params.get("page"));
  const [q, setQ] = useState(params.get("q") || "");

  function updateFilters(next: { status?: string; q?: string; sort?: string; dir?: SortDir; page?: number; size?: number }) {
    const sp = new URLSearchParams();
    const st = next.status ?? statusFilter;
    const query = next.q ?? q;
    const sort = next.sort ?? sortBy;
    const dir = next.dir ?? sortDir;
    const size = next.size ?? pageSize;
    const resetPage =
      next.status !== undefined ||
      next.q !== undefined ||
      next.sort !== undefined ||
      next.dir !== undefined ||
      next.size !== undefined;
    const p = next.page ?? (resetPage ? 1 : urlPage);
    if (st && st !== "all") sp.set("status", st);
    if (query.trim()) sp.set("q", query.trim());
    if (sort && sort !== "created_at") sp.set("sort", sort);
    if (dir && dir !== "desc") sp.set("dir", dir);
    if (sort === "created_at" && dir === "asc") {
      sp.set("sort", sort);
      sp.set("dir", dir);
    }
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    setLocation(adminPath(`/customers${qs ? `?${qs}` : ""}`));
  }

  async function load(p = urlPage) {
    const qs = new URLSearchParams({ role: "customer", page: String(p), page_size: String(pageSize) });
    if (statusFilter === "blocked") qs.set("blocked", "true");
    if (statusFilter === "active") qs.set("blocked", "false");
    const qParam = (params.get("q") || "").trim();
    if (qParam) qs.set("q", qParam);
    if (sortBy) qs.set("sort", sortBy);
    if (sortDir) qs.set("dir", sortDir);
    const res = await api<{ items: any[]; total: number; page: number; pages: number } | any[]>(`/admin/users?${qs}`);
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
    setQ(params.get("q") || "");
    void load(urlPage).catch((e) => toast.error(e.message));
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
        <div className="flex items-center gap-2 ml-auto">
          <AdminPager
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onPage={(p) => updateFilters({ page: p })}
            onPageSize={(size) => updateFilters({ size })}
          />
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus size={16} />
            Add customer
          </Button>
        </div>
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
            placeholder="Search ID, name, email, phone, location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q });
            }}
          />
          <Button type="button" onClick={() => updateFilters({ q })}>
            Search
          </Button>
          {params.get("q") ? (
            <Button type="button" variant="outline" onClick={() => { setQ(""); updateFilters({ q: "" }); }}>
              Clear
            </Button>
          ) : null}
        </div>
        {statusFilter !== "all" && (
          <Badge variant="secondary" className="mb-1">
            Showing: {statusFilter}
          </Badge>
        )}
      </div>
      <Table className="border-separate border-spacing-0" containerClassName="max-h-[calc(100vh-16rem)] overflow-auto rounded-lg border bg-card">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHead label="ID" column="id" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Name" column="name" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Email" column="email" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Phone" column="phone" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Location" column="location" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Language" column="language" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Status" column="status" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <StaticHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-mono text-xs">{u.public_id || "—"}</TableCell>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.phone}</TableCell>
              <TableCell className="max-w-[220px] truncate" title={personLocation(u)}>
                {personLocation(u)}
              </TableCell>
              <TableCell>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={PREFERRED_LANGUAGES.some((l) => l.code === (u.preferred_language || "en")) ? (u.preferred_language || "en") : "en"}
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
                  {PREFERRED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
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
                <span title="Cannot delete — bookings stay linked. Use Block to stop access." className="inline-flex">
                  <Button size="sm" variant="destructive" disabled>
                    Delete
                  </Button>
                </span>
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
