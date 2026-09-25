import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiBookings, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { Calendar, Clock, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { PujaTitle } from "@/components/PujaTitle";

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
    case "refunded":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function CustomerHistoryPage() {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiBookings(1, 100, { bucket: "history" })
      .then((r) => setBookings(r.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const history = bookings || [];

  return (
    <CustomerPortal>
      <Card>
        <CardHeader>
          <CardTitle className="">{t("web.booking.history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && history.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("web.booking.noHistory")}</p>
          )}
          {history.map((booking) => (
            <div key={booking.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3>
                  <PujaTitle name={booking.service_name} />
                </h3>
                <Badge className={statusColor(booking.status)}>{t(`status.${booking.status}`)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">#{booking.booking_number}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDisplayDate(booking.booking_date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {booking.start_time || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {booking.location_label || booking.mode || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard size={14} />
                  {rupees(booking.total_paise || 0)}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
