import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, apiBookings, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import { adminPath } from "@/const";
import { toast } from "sonner";
import { notifyBadgesChanged } from "@/components/NotificationBell";
import {
  AdminPager,
  BOOKING_PAGE_SIZES,
  DEFAULT_BOOKING_PAGE_SIZE,
  parsePage,
  parsePageSize,
} from "@/components/AdminPager";

type AvailablePujari = {
  id: string;
  name: string;
  phone?: string;
  approved_level?: number;
  experience_years?: number | null;
  specializations?: unknown;
  location_label?: string | null;
  city?: string | null;
  distance_km?: number | null;
  schedule_conflict?: boolean;
};

type AvailableResponse = {
  booking_number?: string;
  required_level?: number;
  current_pujari_id?: string | null;
  distance_rings_km?: number[];
  primary_ring_km?: number;
  matched_ring_km?: number | null;
  booking_has_coordinates?: boolean;
  default_pujari_available?: boolean;
  nearby_pujaris?: AvailablePujari[];
  other_pujaris?: AvailablePujari[];
  pujaris: AvailablePujari[];
};

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

function statusVariant(status: string) {
  if (status === "rejected") return "destructive" as const;
  return "default" as const;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function last30Dates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function Bookings() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reassignFor, setReassignFor] = useState<any | null>(null);
  const [available, setAvailable] = useState<AvailableResponse | null>(null);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [penaltyFor, setPenaltyFor] = useState<string | null>(null);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const statusFilter = params.get("status") || "all";
  const assignmentFilter = params.get("assignment") || "all";
  const rangeFilter = params.get("range") || "all";
  const dateFrom = params.get("from") || "";
  const dateTo = params.get("to") || "";
  const pageSize = parsePageSize(params.get("size"), BOOKING_PAGE_SIZES, DEFAULT_BOOKING_PAGE_SIZE);
  const urlPage = parsePage(params.get("page"));
  const [q, setQ] = useState(params.get("q") || "");

  function updateFilters(next: {
    status?: string;
    assignment?: string;
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    size?: number;
  }) {
    const sp = new URLSearchParams();
    const st = next.status ?? statusFilter;
    const assign = next.assignment ?? assignmentFilter;
    const range = next.range ?? rangeFilter;
    const from = next.from ?? dateFrom;
    const to = next.to ?? dateTo;
    const query = next.q !== undefined ? next.q : params.get("q") || "";
    const size = next.size ?? pageSize;
    const resetPage =
      next.status !== undefined ||
      next.assignment !== undefined ||
      next.range !== undefined ||
      next.from !== undefined ||
      next.to !== undefined ||
      next.q !== undefined ||
      next.size !== undefined;
    const p = next.page ?? (resetPage ? 1 : urlPage);
    if (st && st !== "all") sp.set("status", st);
    if (assign && assign !== "all") sp.set("assignment", assign);
    if (range && range !== "all") sp.set("range", range);
    if (range === "custom") {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    }
    if (query.trim()) sp.set("q", query.trim());
    if (size !== DEFAULT_BOOKING_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    setLocation(adminPath(`/bookings${qs ? `?${qs}` : ""}`));
  }

  async function load(p = urlPage) {
    const extra: Record<string, string> = { mode: "physical" };
    if (statusFilter && statusFilter !== "all") extra.status = statusFilter;
    if (assignmentFilter && assignmentFilter !== "all") extra.assignment = assignmentFilter;
    const qParam = (params.get("q") || "").trim();
    if (qParam) extra.q = qParam;
    if (rangeFilter === "last_30") {
      const { from, to } = last30Dates();
      extra.date_from = from;
      extra.date_to = to;
    } else if (rangeFilter === "custom") {
      if (dateFrom) extra.date_from = dateFrom;
      if (dateTo) extra.date_to = dateTo;
    }
    const res = await apiBookings(p, pageSize, extra);
    setRows(res.items);
    setPage(res.page);
    setPages(res.pages);
    setTotal(res.total);
  }

  useEffect(() => {
    setQ(params.get("q") || "");
    void load(urlPage).catch((e) => toast.error(e.message));
  }, [search]);

  async function openReassign(booking: any) {
    setReassignFor(booking);
    setAvailable(null);
    setLoadingAvailable(true);
    try {
      setAvailable(await api<AvailableResponse>(`/admin/bookings/${booking.id}/available-pujaris`));
    } catch (e: any) {
      toast.error(e.message || "Could not load available pujaris");
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function assign(pujariId: string, forceAssign = false) {
    if (!reassignFor) return;
    setAssigningId(pujariId);
    try {
      await api(`/admin/bookings/${reassignFor.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ pujari_id: pujariId, force_assign: forceAssign }),
      });
      toast.success("Pujari assigned — waiting for them to accept");
      setReassignFor(null);
      setAvailable(null);
      notifyBadgesChanged();
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not assign pujari");
    } finally {
      setAssigningId(null);
    }
  }

  function requestAssign(p: AvailablePujari) {
    if (p.schedule_conflict) {
      const ok = window.confirm(
        `${p.name} has a scheduling conflict with another confirmed booking (including the platform buffer time). ` +
          "Assign anyway? The pujari may need to adjust their schedule."
      );
      if (!ok) return;
      void assign(p.id, true);
      return;
    }
    void assign(p.id, false);
  }

  async function applyNoShowPenalty(booking: any) {
    const reason = window.prompt(
      `Mark the pujari as a no-show for ${booking.booking_number}? 100% of this puja’s cost will be deducted from their wallet. Add a note (optional).`
    );
    if (reason === null) return;
    setPenaltyFor(booking.id);
    try {
      const out = await api<{ waived: boolean; penalty_paise: number }>(
        `/bookings/${booking.id}/no-show-penalty`,
        { method: "POST", body: JSON.stringify({ waive: false, reason: reason.trim() || null }) }
      );
      toast.success(
        out.waived
          ? "Marked as no-show, no penalty applied"
          : `No-show penalty of ${rupees(out.penalty_paise)} deducted`
      );
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not apply penalty");
    } finally {
      setPenaltyFor(null);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Bookings"
        description="In-person puja bookings. Virtual Puja and Muhurtham requests are managed in their own queues."
        actions={
          <AdminPager
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            sizes={BOOKING_PAGE_SIZES}
            sizeLabel="per page"
            onPage={(p) => updateFilters({ page: p })}
            onPageSize={(size) => updateFilters({ size })}
          />
        }
      />
      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="pending_acceptance">Pending acceptance</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="needs_reassignment">Needs reassignment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pujari</Label>
          <Select value={assignmentFilter} onValueChange={(v) => updateFilters({ assignment: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignments</SelectItem>
              <SelectItem value="unassigned">Needs assignment</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Customer date</Label>
          <Select
            value={rangeFilter}
            onValueChange={(v) => updateFilters({ range: v, from: v === "custom" ? dateFrom : "", to: v === "custom" ? dateTo : "" })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="last_30">Last 30 days</SelectItem>
              <SelectItem value="custom">Between dates</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rangeFilter === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={dateFrom}
                onChange={(e) => updateFilters({ from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={dateTo}
                onChange={(e) => updateFilters({ to: e.target.value })}
              />
            </div>
          </>
        )}
        <div className="flex gap-2 flex-1 min-w-[220px] items-end">
          <Input
            placeholder="Search number, customer, pujari, service"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q });
            }}
          />
          <Button type="button" variant="secondary" onClick={() => updateFilters({ q })}>
            Search
          </Button>
          {(params.get("q") || statusFilter !== "all" || assignmentFilter !== "all" || rangeFilter !== "all") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQ("");
                setLocation(adminPath("/bookings"));
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      <Table
        className="border-separate border-spacing-0"
        containerClassName="max-h-[calc(100vh-16rem)] overflow-auto rounded-lg border bg-card"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 z-20 bg-card border-b">Number</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b">Service</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b">Customer</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b">Pujari</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b">Date</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b">Total</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b">Status</TableHead>
            <TableHead className="sticky top-0 z-20 bg-card border-b text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const needsAttention =
              Boolean(b.needs_reassignment) || b.status === "rejected" || !b.pujari_id;
            const canPenalise = ["confirmed", "in_progress", "completed", "cancelled"].includes(b.status);
            return (
              <TableRow key={b.id} className={cn(needsAttention &&"bg-red-50 hover:bg-red-100/70")}>
                <TableCell>{b.booking_number}</TableCell>
                <TableCell>{b.service_name}</TableCell>
                <TableCell>{b.customer_name}</TableCell>
                <TableCell>{b.pujari_name || "—"}</TableCell>
                <TableCell>
                  {formatDisplayDate(b.booking_date)} {b.start_time}
                </TableCell>
                <TableCell>{rupees(b.total_paise)}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={statusVariant(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                    {!b.pujari_id && (
                      <span className="text-xs font-medium text-red-700">Assign pujari</span>
                    )}
                    {b.pujari_id && b.needs_reassignment && (
                      <span className="text-xs font-medium text-red-700">Needs reassignment</span>
                    )}
                    {b.rejection_reason && (
                      <span className="text-xs text-muted-foreground">{b.rejection_reason}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant={needsAttention ? "default" : "outline"}
                      onClick={() => void openReassign(b)}
                    >
                      {!b.pujari_id ? "Assign pujari" : "Reassign"}
                    </Button>
                    {canPenalise && b.pujari_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={penaltyFor === b.id || Boolean(b.no_show_marked_at)}
                        onClick={() => void applyNoShowPenalty(b)}
                      >
                        {b.no_show_marked_at ? "No-show marked" : "No-show"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No bookings match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={Boolean(reassignFor)}
        onOpenChange={(open) => {
          if (!open) {
            setReassignFor(null);
            setAvailable(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="">
              Reassign {reassignFor?.booking_number || "booking"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAvailable && <p className="text-sm text-muted-foreground">Finding available pujaris…</p>}
            {!loadingAvailable && available && (
              <>
                <p className="text-sm text-muted-foreground">
                  Level {available.required_level} or above. Pujaris with a calendar block are hidden; those with a
                  schedule conflict are shown with a warning — you can override.
                  {available.booking_has_coordinates
                    ? ` Default option: within ${available.primary_ring_km ?? 10} km. Farther available pujaris are listed below as fallback.`
                    : " This booking has no coordinates — distances unavailable; showing all eligible pujaris."}
                </p>

                {(() => {
                  const nearby = available.nearby_pujaris ?? [];
                  const other = available.other_pujaris ?? available.pujaris ?? [];
                  const ring = available.primary_ring_km ?? 10;

                  const renderPujari = (p: AvailablePujari) => {
                    const specializations = parseList(p.specializations);
                    const isCurrent = p.id === available.current_pujari_id;
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            <Badge variant="outline">Level {p.approved_level ?? "—"}</Badge>
                            {isCurrent && <Badge variant="secondary">Currently assigned</Badge>}
                            {p.schedule_conflict && (
                              <Badge variant="destructive">Schedule conflict</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {p.distance_km != null
                              ? `${p.distance_km} km away · `
                              : "Distance unknown · "}
                            {p.experience_years != null
                              ? `${p.experience_years} yrs experience`
                              : "Experience —"}
                            {p.city ? ` · ${p.city}` : p.location_label ? ` · ${p.location_label}` : ""}
                          </div>
                          {specializations.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {specializations.slice(0, 4).map((s) => (
                                <Badge key={s} variant="secondary" className="font-normal">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          disabled={isCurrent || assigningId === p.id}
                          onClick={() => requestAssign(p)}
                        >
                          {assigningId === p.id
                            ? "Assigning…"
                            : p.schedule_conflict
                              ? "Assign anyway"
                              : "Assign"}
                        </Button>
                      </div>
                    );
                  };

                  if (nearby.length === 0 && other.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No eligible pujari is free for this slot.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Default — within {ring} km
                        </p>
                        {nearby.length === 0 ? (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                            No default pujari available within {ring} km.
                          </p>
                        ) : (
                          nearby.map(renderPujari)
                        )}
                      </div>

                      {other.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            Other available pujaris
                            {available.booking_has_coordinates
                              ? ` (beyond ${ring} km or distance unknown)`
                              : ""}
                          </p>
                          {other.map(renderPujari)}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReassignFor(null);
                setAvailable(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
