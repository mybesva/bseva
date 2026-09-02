import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CustomerPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, rupees } from "@/lib/api";
import { Calendar, Clock, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";

const DONE = new Set(["completed", "cancelled", "refunded"]);

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "pending":
    case "pending_acceptance":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function CustomerBookingsPage() {
  const [, setLocation] = useLocation();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setBookings(await api<any[]>("/bookings"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const upcoming = useMemo(
    () =>
      (bookings || [])
        .filter((b) => !DONE.has(b.status))
        .sort((a, b) => String(a.booking_date || "").localeCompare(String(b.booking_date || ""))),
    [bookings]
  );

  const past = useMemo(
    () =>
      (bookings || [])
        .filter((b) => DONE.has(b.status))
        .sort((a, b) => String(b.booking_date || "").localeCompare(String(a.booking_date || ""))),
    [bookings]
  );

  function openReceipt(booking: any) {
    setLocation(`/booking/${booking.id}`);
  }

  return (
    <CustomerPortal>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">My Bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && upcoming.length === 0 && past.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No bookings yet.</p>
          )}
          {upcoming.map((booking) => (
            <div
              key={booking.id}
              className="border rounded-lg p-4 space-y-2 cursor-pointer hover:border-primary/40"
              onClick={() => openReceipt(booking)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading font-semibold">{booking.service_name}</h3>
                  <Badge className={statusColor(booking.status)}>{booking.status.replace(/_/g, " ")}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReceipt(booking);
                  }}
                >
                  Receipt
                </Button>
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
              {!booking.pujari_details_visible && (
                <p className="text-xs text-muted-foreground">
                  Pujari details unlock within 24 hours of the puja.
                </p>
              )}
            </div>
          ))}
          {past.length > 0 && (
            <div className="pt-4 border-t space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">Past</h3>
              {past.map((booking) => (
                <div
                  key={booking.id}
                  className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:border-primary/40"
                  onClick={() => openReceipt(booking)}
                >
                  <div>
                    <div className="font-medium">{booking.service_name}</div>
                    <div className="text-xs text-muted-foreground">
                      #{booking.booking_number} · {booking.booking_date} · {rupees(booking.total_paise || 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColor(booking.status)}>{booking.status}</Badge>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openReceipt(booking); }}>
                      Receipt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
