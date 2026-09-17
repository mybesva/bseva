import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CustomerPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiBookings, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { Calendar, Clock, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

const CANCELLED = new Set(["cancelled", "refunded"]);

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "pending":
    case "pending_acceptance":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
    case "refunded":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatStatus(status: string, t: (key: string) => string) {
  const key = `status.${status}`;
  const translated = t(key);
  return translated === key ? String(status || "").replace(/_/g, " ") : translated;
}

function BookingCard({
  booking,
  onOpen,
  compact = false,
}: {
  booking: any;
  onOpen: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const displayStatus = booking.customer_display_status || booking.status;
  const displayLabel =
    displayStatus === "confirmed" ? t("web.booking.confirmed") : formatStatus(displayStatus, t);
  return (
    <div
      className="border rounded-lg p-4 space-y-2 cursor-pointer hover:border-primary/40"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{booking.service_name}</h3>
          <Badge className={statusColor(displayStatus)}>{displayLabel}</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {t("booking.receipt")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">#{booking.booking_number}</p>
      {!compact && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {formatDisplayDate(booking.booking_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {booking.schedule_display?.customer_local || booking.start_time || "—"}
          </span>
          {booking.mode === "virtual" && booking.schedule_display?.india_local ? (
            <span className="text-xs">India: {booking.schedule_display.india_local}</span>
          ) : null}
          <span className="flex items-center gap-1">
            <MapPin size={14} />
            {booking.location_label || booking.mode || "—"}
          </span>
          <span className="flex items-center gap-1">
            <CreditCard size={14} />
            {rupees(booking.total_paise || 0)}
          </span>
        </div>
      )}
      {compact && (
        <div className="text-xs text-muted-foreground">
          {formatDisplayDate(booking.booking_date)} · {rupees(booking.total_paise || 0)}
        </div>
      )}
      {!booking.pujari_details_visible && !CANCELLED.has(booking.status) && booking.status !== "completed" && (
        <p className="text-xs text-muted-foreground">
          Pujari details unlock within 24 hours of the puja.
        </p>
      )}
    </div>
  );
}

export default function CustomerBookingsPage() {
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  async function load() {
    setLoading(true);
    try {
      const res = await apiBookings(1, 100);
      setBookings(res.items || []);
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
        .filter((b) => !["completed", "cancelled", "refunded"].includes(b.status))
        .sort((a, b) => String(a.booking_date || "").localeCompare(String(b.booking_date || ""))),
    [bookings]
  );

  const completed = useMemo(
    () =>
      (bookings || [])
        .filter((b) => b.status === "completed")
        .sort((a, b) => String(b.booking_date || "").localeCompare(String(a.booking_date || ""))),
    [bookings]
  );

  const cancelled = useMemo(
    () =>
      (bookings || [])
        .filter((b) => CANCELLED.has(b.status))
        .sort((a, b) => String(b.booking_date || "").localeCompare(String(a.booking_date || ""))),
    [bookings]
  );

  function openReceipt(booking: any) {
    setLocation(`/booking/${booking.id}`);
  }

  const lists: Record<string, any[]> = {
    upcoming,
    completed,
    cancelled,
  };

  const emptyMsg: Record<string, string> = {
    upcoming: t("customer.noBookings"),
    completed: t("priest.completed"),
    cancelled: t("status.cancelled"),
  };

  return (
    <CustomerPortal>
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.bookings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-secondary/30 h-auto flex flex-wrap justify-start gap-1 mb-2">
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                {t("customer.upcoming")} ({upcoming.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                {t("status.completed")} ({completed.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                {t("status.cancelled")} ({cancelled.length})
              </TabsTrigger>
            </TabsList>

            {(["upcoming", "completed", "cancelled"] as const).map((key) => (
              <TabsContent key={key} value={key} className="space-y-3 mt-0">
                {loading && <Skeleton className="h-24 w-full" />}
                {!loading && lists[key].length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">{emptyMsg[key]}</p>
                )}
                {!loading &&
                  lists[key].map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      compact={key !== "upcoming"}
                      onOpen={() => openReceipt(booking)}
                    />
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
