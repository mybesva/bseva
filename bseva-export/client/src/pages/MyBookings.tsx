import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, apiBookings, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useI18n } from "@/i18n/I18nProvider";
import { PujaTitle } from "@/components/PujaTitle";

export default function MyBookings() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [bookings, setBookings] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const rows = await apiBookings(1, 100);
    setBookings(rows.items);
  }

  useEffect(() => {
    if (user) void load().catch((e) => toast.error(e.message));
  }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <h2 className="text-h1">{t("web.auth.loginRequired")}</h2>
              <Button onClick={() => setLocation(getLoginUrl({ role: "customer", returnPath: "/my-bookings" }))}>
                {t("nav.login")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const role = user.role === "pujari" || user.role === "head_pujari" ? "pujari" : "customer";

  return (
    <Layout>
      <div className="container py-10 space-y-4">
        <h1 className="text-h1">{t("nav.bookings")}</h1>
        {bookings.length === 0 && <p className="text-muted-foreground">{t("booking.noneYet")}</p>}
        {bookings.map((b) => (
          <Card
            key={b.id}
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setLocation(`/booking/${b.id}`)}
          >
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <PujaTitle name={b.service_name || b.booking_number} />
                <Badge>
                  {(b.customer_display_status || b.status) === "confirmed"
                    ? t("web.booking.confirmed")
                    : t(`status.${String(b.customer_display_status || b.status || "pending")}`)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm items-center" onClick={(e) => e.stopPropagation()}>
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {formatDisplayDate(b.booking_date)} {b.start_time}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {b.location_label || b.mode}
              </span>
              <span>{rupees(b.total_paise)}</span>
              <Button size="sm" variant="secondary" onClick={() => setLocation(`/booking/${b.id}`)}>
                {t("web.booking.detailsReceipt")}
              </Button>
              {["confirmed", "pending_acceptance"].includes(b.status) && role === "customer" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === b.id}
                  onClick={async () => {
                    setBusy(b.id);
                    try {
                      await api(`/bookings/${b.id}/cancel`, { method: "POST" });
                      toast.success(t("status.cancelled"));
                      await load();
                    } catch (e: any) {
                      toast.error(e.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {t("common.cancel")}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
