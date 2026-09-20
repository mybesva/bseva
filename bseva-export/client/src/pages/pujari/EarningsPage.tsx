import { useEffect, useMemo, useState } from "react";
import { PujaTitle } from "@/components/PujaTitle";
import { PujariPortal } from "@/components/RolePortals";
import WalletPanel from "@/components/WalletPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, apiBookings, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { toast } from "sonner";
import { Wallet, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { pujariEarningsStats } from "@bseva/config";
import { useI18n } from "@/i18n/I18nProvider";

export default function PujariEarningsPage() {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiBookings(1, 100), api<any[]>("/settlements").catch(() => [])])
      .then(([b, s]) => {
        setBookings(b.items || []);
        setSettlements(s || []);
      })
      .catch((e) => toast.error(e.message || t("web.earnings.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => pujariEarningsStats(bookings, settlements), [bookings, settlements]);

  return (
    <PujariPortal>
      <section className="mb-6">
        <h1 className="text-h1 mb-1">{t("web.earnings.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("web.earnings.description")}
        </p>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("web.earnings.thisMonth")}</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("web.earnings.completed")}</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("web.earnings.inProgress")}</p>
              <p className="text-xl font-semibold">{loading ? "…" : rupees(stats.pending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-md bg-blue-500/10 p-2 text-blue-700">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("web.earnings.settlementPending")}</p>
              <p className="text-xl font-semibold">{loading ? "…" : rupees(stats.settlementPending)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <WalletPanel variant="priest" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("web.earnings.settlements")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("web.earnings.settled")}</span>
              <span className="font-medium">{rupees(stats.settled)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("web.earnings.awaiting")}</span>
              <span className="font-medium">{rupees(stats.settlementPending)}</span>
            </div>
            {!loading && settlements.length === 0 && (
              <p className="text-muted-foreground pt-2">{t("web.earnings.noSettlements")}</p>
            )}
            {settlements.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between border-t border-border pt-2">
                <div>
                  <p className="font-medium">
                    {rupees(Number(s.status === "blocked" ? s.blocked_paise || 0 : s.settlement_amount_paise || s.amount_paise || s.pujari_amount_paise || 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.booking_number || s.booking_id?.slice?.(0, 8) || t("web.common.booking")}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {s.status === "blocked" ? t("web.earnings.blocked") : t(`status.${s.status || "pending"}`)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("web.earnings.completedPuja")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {!loading && stats.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("web.earnings.noCompleted")}</p>
          )}
          {stats.rows.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
            >
              <div>
                <PujaTitle name={b.service_name || t("web.common.puja")} as="p" className="text-sm" />
                <p className="text-xs text-muted-foreground">
                  {b.booking_number}
                  {b.booking_date
                    ? ` · ${formatDisplayDate(b.booking_date)}`
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
