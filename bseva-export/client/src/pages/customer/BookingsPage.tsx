import { BOOKING_TYPE_FILTERS, displayTokenLabel, sevaTypeFilter, translatedTokenLabel } from "@bseva/config";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import type { SevaRegistration } from "@bseva/types";
import { CustomerPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SevaRegistrationCard from "@/components/customer/SevaRegistrationCard";
import { api, apiBookings, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { Calendar, Clock, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/_core/hooks/useAuth";
import { PujaTitle } from "@/components/PujaTitle";
import { rememberBookingListReturn } from "@/lib/bookingListReturn";

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
  return translatedTokenLabel(t(key), key, status);
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
          <h3 className="min-w-0">
            <PujaTitle name={booking.service_name} />
          </h3>
          <Badge className={statusColor(displayStatus)}>{displayLabel}</Badge>
          <Badge variant="outline">Puja Booking</Badge>
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
            <Calendar size="0.875rem" />
            {formatDisplayDate(booking.booking_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size="0.875rem" />
            {booking.schedule_display?.customer_local || booking.start_time || "—"}
          </span>
          {booking.mode === "virtual" && booking.schedule_display?.india_local ? (
            <span className="text-xs">India: {booking.schedule_display.india_local}</span>
          ) : null}
          <span className="flex items-center gap-1">
            <MapPin size="0.875rem" />
            {booking.location_label || displayTokenLabel(booking.mode)}
          </span>
          <span className="flex items-center gap-1">
            <CreditCard size="0.875rem" />
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

type TypeFilter = (typeof BOOKING_TYPE_FILTERS)[number]["id"];
type ListItem = { kind: "booking"; date: string; booking: any } | { kind: "seva"; date: string; reg: SevaRegistration };

function typeFromSearch(search: string): TypeFilter {
  const value = new URLSearchParams(search).get("type");
  return BOOKING_TYPE_FILTERS.some((f) => f.id === value) ? (value as TypeFilter) : "all";
}

function matchesType(item: ListItem, type: TypeFilter) {
  if (type === "all") return true;
  if (item.kind === "booking") return type === "bookings";
  return sevaTypeFilter(item.reg.service_type) === type;
}

function bucketOf(item: ListItem): "upcoming" | "completed" | "cancelled" {
  const status = String(item.kind === "booking" ? item.booking.status : item.reg.status);
  if (status === "completed") return "completed";
  return CANCELLED.has(status) ? "cancelled" : "upcoming";
}

export default function CustomerBookingsPage() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { t } = useI18n();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<SevaRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const type = typeFromSearch(search);

  async function load() {
    setLoading(true);
    // Loaded separately so a problem with one list never hides the other.
    const [bookingResult, sevaResult] = await Promise.allSettled([
      apiBookings(1, 100),
      api<SevaRegistration[]>("/seva/my-registrations"),
    ]);
    if (bookingResult.status === "fulfilled") {
      const uid = user?.id ? String(user.id) : "";
      setBookings((bookingResult.value.items || []).filter((b: any) => !uid || String(b.customer_id || "") === uid));
    } else {
      toast.error(bookingResult.reason?.message || t("errors.generic"));
    }
    if (sevaResult.status === "fulfilled") {
      setRegistrations(Array.isArray(sevaResult.value) ? sevaResult.value : []);
    } else {
      toast.error(sevaResult.reason?.message || t("errors.generic"));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!user?.id) {
      setBookings([]);
      setRegistrations([]);
      setLoading(false);
      return;
    }
    void load();
    // Reload whenever the signed-in customer changes (e.g. after register).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const lists = useMemo(() => {
    const items: ListItem[] = [
      ...bookings.map((booking) => ({ kind: "booking" as const, date: String(booking.booking_date || ""), booking })),
      ...registrations.map((reg) => ({ kind: "seva" as const, date: String(reg.event_start_at || ""), reg })),
    ].filter((item) => matchesType(item, type));
    const inBucket = (bucket: string) => items.filter((item) => bucketOf(item) === bucket);
    return {
      upcoming: inBucket("upcoming").sort((a, b) => a.date.localeCompare(b.date)),
      completed: inBucket("completed").sort((a, b) => b.date.localeCompare(a.date)),
      cancelled: inBucket("cancelled").sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [bookings, registrations, type]);

  function setType(next: TypeFilter) {
    setLocation(next === "all" ? location : `${location}?type=${next}`, { replace: true });
  }

  function openReceipt(booking: any) {
    rememberBookingListReturn(`${location}${search ? `?${search}` : ""}`);
    setLocation(`/booking/${booking.id}`);
  }

  const showingSevaOnly = type !== "all" && type !== "bookings";
  const emptyMsg: Record<string, string> = {
    upcoming: showingSevaOnly ? t("seva.noRegistrations") : t("customer.noBookings"),
    completed: t("priest.completed"),
    cancelled: t("status.cancelled"),
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <CustomerPortal>
      <Card className="card-static overflow-visible">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle>{t("nav.bookings")}</CardTitle>
          <Button type="button" variant="outline" asChild>
            <Link href="/services">{t("seva.explore")}</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-visible">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {BOOKING_TYPE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={type === filter.id}
                onClick={() => setType(filter.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  type === filter.id
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <div className="sticky top-16 z-30 -mx-6 border-b border-primary/15 bg-card px-6 py-3">
            <TabsList className="bg-secondary/30 h-auto min-h-12 w-full flex flex-wrap justify-start gap-2 overflow-visible p-1.5">
              <TabsTrigger value="upcoming" className="h-auto min-h-10 flex-none px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                {t("customer.upcoming")} ({lists.upcoming.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="h-auto min-h-10 flex-none px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                {t("status.completed")} ({lists.completed.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="h-auto min-h-10 flex-none px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                {t("status.cancelled")} ({lists.cancelled.length})
              </TabsTrigger>
            </TabsList>
            </div>

            {(["upcoming", "completed", "cancelled"] as const).map((key) => (
              <TabsContent key={key} value={key} className="space-y-3 mt-0">
                {loading && <Skeleton className="h-24 w-full" />}
                {!loading && lists[key].length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">{emptyMsg[key]}</p>
                )}
                {!loading &&
                  lists[key].map((item) =>
                    item.kind === "booking" ? (
                      <BookingCard
                        key={item.booking.id}
                        booking={item.booking}
                        compact={key !== "upcoming"}
                        onOpen={() => openReceipt(item.booking)}
                      />
                    ) : (
                      <SevaRegistrationCard key={item.reg.id} reg={item.reg} />
                    ),
                  )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
