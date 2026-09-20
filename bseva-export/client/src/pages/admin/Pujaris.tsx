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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { adminPath } from "@/const";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextSort, personLocation, SortableHead, StaticHead, type SortDir } from "@/components/SortableHead";
import { AdminPager, DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/components/AdminPager";
import { notifyBadgesChanged } from "@/components/NotificationBell";

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

function verificationBadgeClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "pending":
    case "under_review":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "correction_required":
      return "bg-orange-50 text-orange-900 border-orange-200";
    case "rejected":
      return "bg-red-50 text-red-900 border-red-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function formatVerificationStatus(status: string) {
  return (status || "—").replace(/_/g, " ");
}

function PujariRow({ u, levels, onChanged }: { u: any; levels: { level: number; title: string }[]; onChanged: () => Promise<void> }) {
  const [, setLocation] = useLocation();
  const [level, setLevel] = useState(Number(u.approved_level || u.requested_level || 1));
  const [saving, setSaving] = useState(false);
  const specializations = parseList(u.specializations);

  useEffect(() => {
    setLevel(Number(u.approved_level || u.requested_level || 1));
  }, [u.approved_level, u.requested_level]);

  async function saveLevel(next: number) {
    setLevel(next);
    const approved = Number(u.approved_level);
    if (Number.isFinite(approved) && next === approved) return;
    setSaving(true);
    try {
      await api(`/admin/pujaris/${u.id}/level`, {
        method: "POST",
        body: JSON.stringify({ approved_level: next }),
      });
      toast.success(`Level ${next} saved`);
      await onChanged();
    } catch (e: any) {
      toast.error(e.message);
      setLevel(Number(u.approved_level || u.requested_level || 1));
    } finally {
      setSaving(false);
    }
  }

  async function setVerification(status: string) {
    try {
      await api(`/admin/pujaris/${u.id}/verify`, {
        method: "POST",
        body: JSON.stringify({ verification_status: status, approved_level: level }),
      });
      toast.success(formatVerificationStatus(status));
      notifyBadgesChanged();
      await onChanged();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const verifiedCount = u.verified_service_count ?? 0;
  const appliedCount = u.applied_service_count ?? 0;
  const pendingServices = u.pending_service_review_count ?? 0;
  const openServices = () => setLocation(adminPath(`/pujaris/${u.id}#services`));

  return (
    <TableRow className="align-top">
      <TableCell className="font-mono text-xs whitespace-nowrap">{u.public_id || "—"}</TableCell>
      <TableCell className="min-w-[140px]">
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
      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={u.email}>
        {u.email}
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-sm" title={personLocation(u)}>
        {personLocation(u)}
      </TableCell>
      <TableCell>
        <div className="space-y-1 min-w-[200px] max-w-[240px]">
          <p className="text-[11px] text-muted-foreground">Requested level {u.requested_level ?? "—"}</p>
          <Select value={String(level)} onValueChange={(v) => void saveLevel(Number(v))} disabled={saving}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((l) => (
                <SelectItem key={l.level} value={String(l.level)} className="text-xs">
                  Level {l.level} — {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving ? <p className="text-[11px] text-muted-foreground">Saving…</p> : null}
        </div>
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {u.experience_years == null || u.experience_years === "" ? (
          "—"
        ) : (
          <span title={specializations.join(", ") || undefined}>
            {u.experience_years} yrs
            {specializations.length > 0 ? (
              <span className="block text-xs text-muted-foreground truncate max-w-[120px]">
                {specializations.slice(0, 2).join(", ")}
                {specializations.length > 2 ? ` +${specializations.length - 2}` : ""}
              </span>
            ) : null}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2 min-w-[130px]">
          <div className="text-xs leading-relaxed">
            <span className="font-medium text-foreground">{verifiedCount}</span>
            <span className="text-muted-foreground"> verified</span>
            <span className="text-muted-foreground"> · {appliedCount} applied</span>
          </div>
          {pendingServices > 0 ? (
            <Button size="sm" className="h-8 w-fit" type="button" onClick={openServices}>
              Review ({pendingServices})
            </Button>
          ) : (
            <button
              type="button"
              className="text-xs text-primary font-medium hover:underline w-fit text-left"
              onClick={openServices}
            >
              Open services
            </button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("capitalize font-normal whitespace-nowrap", verificationBadgeClass(u.verification_status))}
        >
          {formatVerificationStatus(u.verification_status)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={u.blocked ? "destructive" : "outline"} className="font-normal">
          {u.blocked ? "Blocked" : "Active"}
        </Badge>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setLocation(adminPath(`/pujaris/${u.id}`))}>
            Profile
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-1 px-2">
                Actions
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => void setVerification("approved")}>Approve profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void setVerification("correction_required")}>
                Request correction
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void setVerification("rejected")}>Reject profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openServices}>Review services</DropdownMenuItem>
              <DropdownMenuSeparator />
              {u.is_head_pujari || u.role === "head_pujari" ? (
                <DropdownMenuItem
                  onClick={async () => {
                    await api(`/admin/pujaris/${u.id}/head`, {
                      method: "POST",
                      body: JSON.stringify({ is_head_pujari: false, scope_cities: [] }),
                    });
                    toast.success("Removed Head Pujari");
                    await onChanged();
                  }}
                >
                  Remove head pujari
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={async () => {
                    await api(`/admin/pujaris/${u.id}/head`, {
                      method: "POST",
                      body: JSON.stringify({ is_head_pujari: true, scope_cities: [] }),
                    });
                    toast.success("Marked Head Pujari");
                    await onChanged();
                  }}
                >
                  Make head pujari
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={async () => {
                  await api(`/admin/users/${u.id}/block`, {
                    method: "POST",
                    body: JSON.stringify({ blocked: !u.blocked, reason: "Admin action" }),
                  });
                  toast.success(u.blocked ? "Unblocked" : "Blocked");
                  await onChanged();
                }}
              >
                {u.blocked ? "Unblock account" : "Block account"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Delete account — use Block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
    setLocation(adminPath(`/pujaris${qs ? `?${qs}` : ""}`));
  }

  async function load(p = urlPage) {
    const qs = new URLSearchParams({ page: String(p), page_size: String(pageSize) });
    if (statusFilter && statusFilter !== "all") qs.set("status", statusFilter);
    const qParam = (params.get("q") || "").trim();
    if (qParam) qs.set("q", qParam);
    if (sortBy) qs.set("sort", sortBy);
    if (sortDir) qs.set("dir", sortDir);
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
    setQ(params.get("q") || "");
    void load(urlPage).catch((e) => toast.error(e.message));
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
        <div className="flex items-center gap-2 ml-auto">
          <AdminPager
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onPage={(p) => updateFilters({ page: p })}
            onPageSize={(size) => updateFilters({ size })}
            sizeLabel="IDs / page"
          />
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
            placeholder="Search ID, name, email, phone, location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q });
            }}
          />
          <Button type="button" variant="secondary" onClick={() => updateFilters({ q })}>
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

      <Table className="border-separate border-spacing-0" containerClassName="max-h-[calc(100vh-16rem)] overflow-auto rounded-lg border bg-card">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHead label="ID" column="id" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} className="w-[100px]" />
            <SortableHead label="Name" column="name" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Email" column="email" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} className="max-w-[200px]" />
            <SortableHead label="Location" column="location" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Approved level" column="approved_level" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} className="min-w-[200px]" />
            <SortableHead label="Experience" column="experience" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Services" column="services" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} className="min-w-[130px]" />
            <SortableHead label="Verification" column="verification" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <SortableHead label="Account" column="account" sortBy={sortBy} sortDir={sortDir} onSort={(c) => updateFilters(nextSort(sortBy, sortDir, c))} />
            <StaticHead label="Actions" className="text-right min-w-[160px]" />
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
