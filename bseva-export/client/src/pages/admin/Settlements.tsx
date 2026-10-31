import { displayTokenLabel } from "@bseva/config";
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

function settledBy(s: any, name?: string | null) {
  if (name) return name;
  if (s.status === "settled" && s.payment_reference?.startsWith("AUTO_")) return "System (automatic)";
  return "—";
}

export default function AdminSettlements() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdDays, setHoldDays] = useState(3);
  const [active, setActive] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [mpin, setMpin] = useState("");
  const [otp, setOtp] = useState("");
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
      const days = Number(cfg?.pujari_settlement_days ?? 3);
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

  function closeDialog() {
    setActive(null);
    setReason("");
    setRef("");
    setChallengeId(null);
    setMpin("");
    setOtp("");
  }

  async function requestOtp() {
    if (!active) return;
    if (reason.trim().length < 3) {
      toast.error("Reason required");
      return;
    }
    setSaving(true);
    try {
      const out = await api<{ challenge_id: string; email?: string; expires_in_minutes: number }>("/admin/security/challenge", {
        method: "POST",
        body: JSON.stringify({
          action: "settlement_override",
          settlement_id: active.id,
          payment_reference: ref.trim() || null,
        }),
      });
      setChallengeId(out.challenge_id);
      setOtp("");
      toast.success(`OTP sent to ${out.email || "your email"}. Valid for ${out.expires_in_minutes} minutes.`);
    } catch (e: any) {
      if (e.code === "MPIN_NOT_SET") setLocation(adminPath("/security"));
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function settle() {
    if (!active || !challengeId) return;
    setSaving(true);
    try {
      await api(`/settlements/${active.id}/override`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          mark_settled: true,
          payment_reference: ref.trim() || null,
          challenge_id: challengeId,
          otp,
          mpin,
        }),
      });
      // Reached only after the server has credited the wallet and committed.
      toast.success("Settlement paid and recorded");
      closeDialog();
      await load();
    } catch (e: any) {
      toast.error(e.message);
      setMpin("");
      setOtp("");
      if (["VERIFICATION_EXPIRED", "VERIFICATION_MISMATCH", "OTP_ATTEMPTS_EXCEEDED", "MPIN_LOCKED"].includes(e.code)) {
        setChallengeId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Settlements"
        description={<>Pujaris are paid automatically every <strong>{holdDays} days</strong>, counted from each pujari's joining date. Use <strong>Settle / override</strong> only for early payout or special cases.</>}
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
            <SelectTrigger className="w-[11.25rem]">
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
            <SelectTrigger className="w-[11.25rem]">
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
              <Input type="date" className="h-9 w-[9.375rem]" value={dateFrom} onChange={(e) => updateFilters({ from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-[9.375rem]" value={dateTo} onChange={(e) => updateFilters({ to: e.target.value })} />
            </div>
          </>
        )}
        <div className="flex gap-2 flex-1 min-w-[13.75rem] items-end">
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
              <TableHead className={TH}>Processed by</TableHead>
              <TableHead className={TH}>Approved by</TableHead>
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
                    {displayTokenLabel(s.status)}
                    {s.status === "settled" && s.payment_reference?.startsWith("AUTO_") ? " · auto" : ""}
                    {s.status === "settled" && s.override_flag ? " · override" : ""}
                    {s.status === "blocked" && s.blocked_reason === "pujari_no_show" ? " · no-show" : ""}
                  </Badge>
                </TableCell>
                <TableCell>{formatDisplayDate(s.due_date)}</TableCell>
                <TableCell>{rupees(s.customer_payment_paise)}</TableCell>
                <TableCell>{rupees(s.platform_fee_paise)}</TableCell>
                <TableCell>{rupees(s.settlement_amount_paise)}</TableCell>
                <TableCell>{blockedAmount(s) ? rupees(blockedAmount(s)) : "—"}</TableCell>
                <TableCell title={s.processed_by_email || undefined}>{settledBy(s, s.processed_by_name)}</TableCell>
                <TableCell title={s.approved_by_email || undefined}>{settledBy(s, s.approved_by_name)}</TableCell>
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
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  No settlements match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && closeDialog()}>
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
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} disabled={!!challengeId} />
            </div>
            <div className="space-y-1">
              <Label>Payment reference (optional)</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} disabled={!!challengeId} />
            </div>
            {challengeId ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="settle-mpin">MPIN</Label>
                  <Input
                    id="settle-mpin"
                    type="password"
                    value={mpin}
                    onChange={(e) => setMpin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settle-otp">Email OTP</Label>
                  <Input
                    id="settle-otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            {challengeId ? (
              <>
                <Button variant="outline" onClick={() => void requestOtp()} disabled={saving}>
                  Resend OTP
                </Button>
                <Button onClick={() => void settle()} disabled={saving || mpin.length !== 6 || otp.length !== 6}>
                  {saving ? "Verifying…" : "Confirm payment"}
                </Button>
              </>
            ) : (
              <Button onClick={() => void requestOtp()} disabled={saving}>
                {saving ? "Sending…" : "Send OTP"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
