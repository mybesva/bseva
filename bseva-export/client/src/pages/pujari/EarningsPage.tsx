import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import WalletPanel from "@/components/WalletPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";
import { IndianRupee, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { format, isSameMonth, parseISO, startOfMonth } from "date-fns";

function priestShare(b: any) {
  if (b.pujari_payable_paise != null) return Number(b.pujari_payable_paise);
  return Math.max(0, Number(b.base_price_paise || 0) - Number(b.platform_fee_paise || 0));
}

export default function PujariEarningsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api<any[]>("/bookings"), api<any[]>("/settlements").catch(() => [])])
      .then(([b, s]) => {
        setBookings(b || []);
        setSettlements(s || []);
      })
      .catch((e) => toast.error(e.message || "Could not load earnings"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    let thisMonth = 0;
    let completed = 0;
    let pending = 0;
    const rows: any[] = [];
    for (const b of bookings) {
      const status = b.status;
      const share = priestShare(b);
      const d = b.booking_date ? parseISO(String(b.booking_date).slice(0, 10)) : null;
      if (["completed", "confirmed", "in_progress"].includes(status)) {
        if (d && isSameMonth(d, monthStart)) thisMonth += share;
      }
      if (status === "completed") {
        completed += share;
        rows.push(b);
      } else if (["confirmed", "in_progress"].includes(status)) {
        pending += share;
      }
    }
    const settled = settlements
      .filter((s) => s.status === "paid" || s.status === "settled")
      .reduce((sum, s) => sum + Number(s.amount_paise || s.pujari_amount_paise || 0), 0);
    const settlementPending = settlements
      .filter((s) => s.status === "pending" || s.status === "held")
      .reduce((sum, s) => sum + Number(s.amount_paise || s.pujari_amount_paise || 0), 0);
    return { thisMonth, completed, pending, settled, settlementPending, rows: rows.slice(0, 40) };
  }, [bookings, settlements]);

  return (
    <PujariPortal>
      <section className="mb-6">
        <h1 className="text-h1 mb-1">Tracking Earnings</h1>
        <p className="text-muted-foreground text-sm">
          Your puja shares, wallet balance, and settlement status.
        </p>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">This month</p>
              <p className="text-xl font-semibold">{loading ? "…" : rupees(stats.thisMonth)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed earnings</p>
              <p className="text-xl font-semibold">{loading ? "…" : rupees(stats.completed)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-700">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">In progress / confirmed</p>
              <p className="text-xl font-semibold">{loading ? "…" : rupees(stats.pending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-md bg-blue-500/10 p-2 text-blue-700">
              <IndianRupee size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Settlement pending</p>
              <p className="text-xl font-semibold">{loading ? "…" : rupees(stats.settlementPending)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <WalletPanel variant="priest" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already settled / paid</span>
              <span className="font-medium">{rupees(stats.settled)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Awaiting settlement</span>
              <span className="font-medium">{rupees(stats.settlementPending)}</span>
            </div>
            {!loading && settlements.length === 0 && (
              <p className="text-muted-foreground pt-2">No settlement records yet. They appear after completed pujas.</p>
            )}
            {settlements.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between border-t border-border pt-2">
                <div>
                  <p className="font-medium">{rupees(Number(s.amount_paise || s.pujari_amount_paise || 0))}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.booking_number || s.booking_id?.slice?.(0, 8) || "Booking"}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {s.status || "pending"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed puja earnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && stats.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No completed pujas yet.</p>
          )}
          {stats.rows.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
            >
              <div>
                <p className="font-medium text-sm">{b.service_name || "Puja"}</p>
                <p className="text-xs text-muted-foreground">
                  {b.booking_number}
                  {b.booking_date
                    ? ` · ${format(parseISO(String(b.booking_date).slice(0, 10)), "dd MMM yyyy")}`
                    : ""}
                </p>
              </div>
              <p className="font-semibold text-primary">{rupees(priestShare(b))}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
