import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, rupees } from "@/lib/api";
import { formatDisplayDate, lastNDaysRange } from "@/lib/formatDate";
import { adminPath } from "@/const";
import { toast } from "sonner";
import {
  AdminPager,
  BOOKING_PAGE_SIZES,
  DEFAULT_BOOKING_PAGE_SIZE,
  parsePage,
  parsePageSize,
} from "@/components/AdminPager";

function blockedAmount(s: any) {
  return Number(s?.blocked_paise || 0);
}

const TH = "sticky top-0 z-20 bg-card border-b";

export default function AdminSettlements() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdDays, setHoldDays] = useState(14);
  const [active, setActive] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [awaiting, setAwaiting] = useState(0);
  const [settled, setSettled] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const statusFilter = params.get("status") || "all";
  const rangeFilter = params.get("range") || "all";
  const dateFrom = params.get("from") || "";
  const dateTo = params.get("to") || "";
  const pageSize = parsePageSize(params.get("size"), BOOKING_PAGE_SIZES, DEFAULT_BOOKING_PAGE_SIZE);
  const urlPage = parsePage(params.get("page"));
  const [q, setQ] = useState(params.get("q") || "");

  function updateFilters(next: {
    status?: string;
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    size?: number;
  }) {
    const sp = new URLSearchParams();
    const st = next.status ?? statusFilter;
    const range = next.range ?? rangeFilter;
    const from = next.from ?? dateFrom;
    const to = next.to ?? dateTo;
    const query = next.q !== undefined ? next.q : params.get("q") || "";
    const size = next.size ?? pageSize;
    const resetPage =
      next.status !== undefined ||
      next.range !== undefined ||
      next.from !== undefined ||
      next.to !== undefined ||
      next.q !== undefined ||
      next.size !== undefined;
    const p = next.page ?? (resetPage ? 1 : urlPage);
    if (st && st !== "all") sp.set("status", st);
    if (range && range !== "all") sp.set("range", range);
    if (range === "custom") {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    }
    if (query.trim()) sp.set("q", query.trim());
    if (size !== DEFAULT_BOOKING_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    setLocation(adminPath(`/settlements${qs ? `?${qs}` : ""}`));
  }

  async function load(p = urlPage) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), limit: String(pageSize) });
      if (statusFilter && statusFilter !== "all") qs.set("status", statusFilter);
      const qParam = (params.get("q") || "").trim();
      if (qParam) qs.set("q", qParam);
      if (rangeFilter === "last_30") {
        const { from, to } = lastNDaysRange(30);
        qs.set("date_from", from);
        qs.set("date_to", to);
      } else if (rangeFilter === "custom") {
        if (dateFrom) qs.set("date_from", dateFrom);
        if (dateTo) qs.set("date_to", dateTo);
      }
      const [res, cfg] = await Promise.all([
        api<any>(`/settlements?${qs}`),
        api<Record<string, unknown>>("/admin/config").catch(() => ({})),
      ]);
      if (Array.isArray(res)) {
        setRows(res);
        setTotal(res.length);
        setPage(1);
        setPages(1);
        setAwaiting(res.filter((s) => s.status === "pending" || s.status === "eligible").length);
        setSettled(res.filter((s) => s.status === "settled").length);
        setBlocked(res.filter((s) => s.status === "blocked").length);
      } else {
        setRows(res.items || []);
        setTotal(res.total || 0);
        setPage(res.page || p);
        setPages(res.pages || 1);
        setAwaiting(Number(res.stats?.awaiting || 0));
        setSettled(Number(res.stats?.settled || 0));
        setBlocked(Number(res.stats?.blocked || 0));
        if (res.hold_days) setHoldDays(Number(res.hold_days));
      }
      const days = Number(cfg?.pujari_settlement_days ?? 14);
      if (Number.isFinite(days) && days > 0) setHoldDays(days);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQ(params.get("q") || "");
    void load(urlPage);
  }, [search]);

  async function settle() {
    if (!active) return;
    if (reason.trim().length < 3) {
      toast.error("Reason required");
      return;
    }
    setSaving(true);
    try {
      await api(`/settlements/${active.id}/override`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          mark_settled: true,
          payment_reference: ref.trim() || null,
        }),
      });
      toast.success("Settlement marked settled (override)");
      setActive(null);
      setReason("");
      setRef("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Settlements"
        description={<>Pujari earnings settle automatically every <strong>{holdDays} days</strong> after a completed puja. Use <strong>Settle / override</strong> only for early payout or special cases.</>}
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

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto cycle</p>
            <p className="text-lg font-semibold text-primary">Every {holdDays} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting cycle</p>
            <p className="text-lg font-semibold">{awaiting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Settled</p>
            <p className="text-lg font-semibold">{settled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Blocked (no-show)</p>
            <p className="text-lg font-semibold">{blocked}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="awaiting">Awaiting cycle</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="eligible">Eligible</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Due date</Label>
          <Select
            value={rangeFilter}
            onValueChange={(v) =>
              updateFilters({ range: v, from: v === "custom" ? dateFrom : "", to: v === "custom" ? dateTo : "" })
            }
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
              <Input type="date" className="h-9 w-[150px]" value={dateFrom} onChange={(e) => updateFilters({ from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-[150px]" value={dateTo} onChange={(e) => updateFilters({ to: e.target.value })} />
            </div>
          </>
        )}
        <div className="flex gap-2 flex-1 min-w-[220px] items-end">
          <Input
            placeholder="Search booking, pujari, customer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q });
            }}
          />
          <Button type="button" variant="secondary" onClick={() => updateFilters({ q })}>
            Search
          </Button>
          {(params.get("q") || statusFilter !== "all" || rangeFilter !== "all") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQ("");
                setLocation(adminPath("/settlements"));
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Table
          className="border-separate border-spacing-0"
          containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-lg border bg-card"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Booking</TableHead>
              <TableHead className={TH}>Pujari</TableHead>
              <TableHead className={TH}>Customer</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={TH}>Due</TableHead>
              <TableHead className={TH}>Customer paid</TableHead>
              <TableHead className={TH}>Platform fee</TableHead>
              <TableHead className={TH}>Pujari payable</TableHead>
              <TableHead className={TH}>Blocked</TableHead>
              <TableHead className={TH} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.booking_number || String(s.booking_id || "").slice(0, 8)}</TableCell>
                <TableCell>{s.pujari_name || "—"}</TableCell>
                <TableCell>{s.customer_name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "settled" ? "default" : s.status === "blocked" ? "destructive" : "secondary"}>
                    {s.status}
                    {s.status === "settled" && s.payment_reference === "AUTO_BIWEEKLY" ? " · auto" : ""}
                    {s.status === "settled" && s.override_flag ? " · override" : ""}
                    {s.status === "blocked" && s.blocked_reason === "pujari_no_show" ? " · no-show" : ""}
                  </Badge>
                </TableCell>
                <TableCell>{formatDisplayDate(s.due_date)}</TableCell>
                <TableCell>{rupees(s.customer_payment_paise)}</TableCell>
                <TableCell>{rupees(s.platform_fee_paise)}</TableCell>
                <TableCell>{rupees(s.settlement_amount_paise)}</TableCell>
                <TableCell>{blockedAmount(s) ? rupees(blockedAmount(s)) : "—"}</TableCell>
                <TableCell>
                  {s.status !== "settled" && s.status !== "blocked" && (
                    <Button size="sm" variant="outline" onClick={() => setActive(s)}>
                      Settle / override
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No settlements match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override — settle early</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Normally this settles automatically on the due date ({formatDisplayDate(active?.due_date)}). Override credits the
              pujari wallet now with {rupees(active?.settlement_amount_paise)}.
            </p>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Payment reference (optional)</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button onClick={() => void settle()} disabled={saving}>
              {saving ? "Saving…" : "Confirm override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
