import { useEffect, useMemo, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, rupees } from "@/lib/api";
import { Calendar, Clock, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";

const HISTORY = new Set(["completed", "cancelled", "refunded"]);

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
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<any[]>("/bookings")
      .then(setBookings)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const history = useMemo(
    () =>
      (bookings || [])
        .filter((b) => HISTORY.has(b.status))
        .sort((a, b) => String(b.booking_date || "").localeCompare(String(a.booking_date || ""))),
    [bookings]
  );

  return (
    <CustomerPortal>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Booking History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && history.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No completed or cancelled bookings yet.</p>
          )}
          {history.map((booking) => (
            <div key={booking.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading font-semibold">{booking.service_name}</h3>
                <Badge className={statusColor(booking.status)}>{booking.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">#{booking.booking_number}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {booking.booking_date || "—"}
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
