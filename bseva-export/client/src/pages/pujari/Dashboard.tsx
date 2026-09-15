import { PujariPortal } from "@/components/RolePortals";
import BookingDetailPanel from "@/components/BookingDetailPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, apiBookings } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  displayStatus,
  formatPaise,
  isExpiredBooking,
  isUpcomingBooking,
  mapApiBooking,
  bookingStartAt,
  statusBadgeClass,
  type PujariBookingRow,
} from "@/lib/pujariBookings";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Sparkles,
  IndianRupee,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  PlayCircle,
  AlertCircle,
  Video,
} from "lucide-react";
import { format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import WalletPanel from "@/components/WalletPanel";
import { useI18n } from "@/i18n/I18nProvider";

const DASHBOARD_LIST_LIMIT = 4;

type BookingRow = PujariBookingRow;

function PujariDashboardContent() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [detailIntent, setDetailIntent] = useState<"accept" | "reject" | null>(null);
  const [listTab, setListTab] = useState("completed");
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pujariProfile, setPujariProfile] = useState<any>(null);

  async function loadBookings() {
    const rows = await apiBookings(1, 100);
    setBookings(rows.items);
  }

  useEffect(() => {
    if (!user || (user.role !== "pujari" && user.role !== "head_pujari" && user.role !== "admin" && user.role !== "super_admin")) return;
    setIsLoading(true);
    Promise.all([
      loadBookings(),
      user.role === "pujari" || user.role === "head_pujari"
        ? api<any>("/pujari/profile").then(setPujariProfile)
        : Promise.resolve(),
    ])
      .catch((e) => toast.error(e.message))
      .finally(() => setIsLoading(false));
  }, [user]);

  const rows = useMemo(() => (bookings || []).map(mapApiBooking), [bookings]);
  const now = new Date();
  const monthStart = startOfMonth(now);

  const stats = useMemo(() => {
    const completed = rows.filter((r) => r.booking.status === "completed");
    const upcoming = rows.filter((r) => isUpcomingBooking(r, now));
    const pending = rows.filter(
      (r) =>
        ["pending", "pending_acceptance", "confirmed"].includes(r.booking.status) &&
        !isExpiredBooking(r, now)
    );

    const earningStatuses = ["completed", "confirmed", "in_progress"];
    const totalEarnings = rows
      .filter((r) => earningStatuses.includes(r.booking.status) && !isExpiredBooking(r, now))
      .reduce((sum, r) => sum + (r.booking.priestAmount || 0), 0);

    const monthEarnings = rows
      .filter(
        (r) =>
          earningStatuses.includes(r.booking.status) &&
          !isExpiredBooking(r, now) &&
          r.booking.bookingDate &&
          isSameMonth(new Date(r.booking.bookingDate), now)
      )
      .reduce((sum, r) => sum + (r.booking.priestAmount || 0), 0);

    const completedEarnings = completed.reduce((sum, r) => sum + (r.booking.priestAmount || 0), 0);

    return {
      totalEarnings,
      monthEarnings,
      completedEarnings,
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      totalBookings: rows.length,
    };
  }, [rows]);

  const bookingDates = useMemo(() => {
    return rows
      .map((b) => (b.booking.bookingDate ? new Date(b.booking.bookingDate) : null))
      .filter(Boolean) as Date[];
  }, [rows]);

  const dayBookings = useMemo(() => {
    if (!selectedDate) return [];
    return rows.filter(
      (b) => b.booking.bookingDate && isSameDay(new Date(b.booking.bookingDate), selectedDate)
    );
  }, [rows, selectedDate]);

  const pendingAcceptance = useMemo(
    () =>
      rows.filter(
        (r) =>
          ["pending", "pending_acceptance"].includes(r.booking.status) && !isExpiredBooking(r, now)
      ),
    [rows]
  );

  const readyToStart = useMemo(
    () =>
      rows.filter(
        (r) => r.booking.status === "confirmed" && !isExpiredBooking(r, now)
      ),
    [rows]
  );

  const upcoming = useMemo(() => {
    return rows
      .filter((b) => isUpcomingBooking(b, now))
      .sort(
        (a, b) =>
          new Date(a.booking.bookingDate!).getTime() - new Date(b.booking.bookingDate!).getTime()
      );
  }, [rows]);

  const completedOnly = useMemo(() => {
    return rows
      .filter((b) => b.booking.status === "completed")
      .sort(
        (a, b) =>
          new Date(b.booking.bookingDate || 0).getTime() -
          new Date(a.booking.bookingDate || 0).getTime()
      );
  }, [rows]);

  const cancelledOnly = useMemo(() => {
    return rows
      .filter((b) => ["cancelled", "refunded"].includes(b.booking.status))
      .sort(
        (a, b) =>
          new Date(b.booking.bookingDate || 0).getTime() -
          new Date(a.booking.bookingDate || 0).getTime()
      );
  }, [rows]);

  const expiredOnly = useMemo(() => {
    return rows
      .filter((b) => isExpiredBooking(b, now))
      .sort(
        (a, b) =>
          new Date(b.booking.bookingDate || 0).getTime() -
          new Date(a.booking.bookingDate || 0).getTime()
      );
  }, [rows]);

  const ongoing = useMemo(() => {
    const nowMs = Date.now();
    return rows.filter((r) => {
      if (isExpiredBooking(r, now)) return false;
      if (r.booking.status === "in_progress") return true;
      if (r.booking.status !== "confirmed") return false;
      const start = bookingStartAt(r);
      if (!start) return true;
      const ms = start.getTime() - nowMs;
      return ms <= 24 * 60 * 60 * 1000 && ms >= -2 * 60 * 60 * 1000;
    });
  }, [rows]);

  const metricCards = [
    {
      title: "Total Dakshina",
      value: formatPaise(stats.totalEarnings),
      hint: "Dakshina from confirmed & completed pujas",
      icon: IndianRupee,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
    {
      title: "This Month",
      value: formatPaise(stats.monthEarnings),
      hint: format(monthStart, "MMMM yyyy"),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Upcoming",
      value: String(stats.upcomingCount),
      hint: `${stats.pendingCount} pending / confirmed`,
      icon: Hourglass,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Completed",
      value: String(stats.completedCount),
      hint: `${formatPaise(stats.completedEarnings)} earned`,
      icon: CheckCircle2,
      color: "text-emerald-700",
      bg: "bg-emerald-100",
    },
  ];

  const actionHint = (row: BookingRow) => {
    const status = row.booking.status;
    if (isExpiredBooking(row, now)) return null;
    if (status === "pending" || status === "pending_acceptance") return "Accept required";
    if (status === "confirmed") return "Start with OTP";
    if (status === "in_progress") return "Complete when done";
    return null;
  };

  const BookingListItem = ({
    row,
    showAcceptReject = false,
  }: {
    row: BookingRow;
    showAcceptReject?: boolean;
  }) => {
    const hint = actionHint(row);
    const shown = displayStatus(row, now);
    const openDetail = (intent: "accept" | "reject" | null = null) => {
      setDetailIntent(intent);
      setSelectedBooking(row);
    };
    return (
      <div className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors">
        <button type="button" onClick={() => openDetail(null)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-primary shrink-0" />
                <span className="truncate">{row.pujaType.name}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span className="flex items-center gap-1">
                  <CalendarIcon size={14} />
                  {row.booking.bookingDate
                    ? formatDisplayDate(row.booking.bookingDate)
                    : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {row.booking.bookingTime || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {row.booking.city || "—"}
                </span>
              </div>
              <div className="text-sm font-medium text-primary mt-2">
                Dakshina: {formatPaise(row.booking.priestAmount || 0)}
              </div>
              {hint && !showAcceptReject && (
                <p className="text-xs text-orange-700 mt-1 font-medium">{hint}</p>
              )}
              {row.booking.mode === "virtual" && row.booking.meetingUrl && (
                <div className="mt-3 rounded-md border-2 border-blue-300 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-2">
                    <Video size={14} className="text-blue-600" />
                    Google Meet ready
                  </p>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(row.booking.meetingUrl!, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Join Google Meet
                  </Button>
                </div>
              )}
            </div>
            <Badge className={statusBadgeClass(shown)}>
              {shown.replace(/_/g, " ")}
            </Badge>
          </div>
        </button>
        {showAcceptReject && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openDetail("accept");
              }}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                openDetail("reject");
              }}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  };

  const completedPreview = completedOnly.slice(0, DASHBOARD_LIST_LIMIT);
  const cancelledPreview = cancelledOnly.slice(0, DASHBOARD_LIST_LIMIT);
  const expiredPreview = expiredOnly.slice(0, DASHBOARD_LIST_LIMIT);
  const profileStatus = pujariProfile?.profile_status || "profile_incomplete";

  return (
    <>
      <section className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">
          Namaste, {user?.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("priest.subtitle")}</p>
        {user?.public_id ? (
          <p className="mt-1 text-sm text-muted-foreground font-mono">ID: {user.public_id}</p>
        ) : null}
      </section>

      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-none shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-28" />
                  </CardContent>
                </Card>
              ))
            : metricCards.map((m) => (
                <Card key={m.title} className="border-none shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-lg ${m.bg}`}>
                        <m.icon className={`w-5 h-5 ${m.color}`} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{m.title}</p>
                    <p className="text-2xl font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.hint}</p>
                  </CardContent>
                </Card>
              ))}
        </div>

        <Card className="border-2 border-blue-200 bg-blue-50/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <PlayCircle className="text-blue-600" size={20} />
              {t("priest.ongoingPuja")}
              {!isLoading && ongoing.length > 0 ? (
                <Badge className="bg-blue-100 text-blue-800 ml-1">{ongoing.length}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : ongoing.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No puja in progress right now. Confirmed bookings appear under Ready to start when it is time to begin.
              </p>
            ) : (
              ongoing.map((row) => <BookingListItem key={row.booking.id} row={row} />)
            )}
          </CardContent>
        </Card>

        {(profileStatus === "profile_incomplete" || profileStatus === "ready_for_submission") &&
          !pujariProfile?.profile_submitted_at && (
          <Card className="border-primary/30 bg-orange-50">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">{t("pujari.profile.prompt")}</p>
              <Button size="sm" onClick={() => setLocation("/pujari/onboarding")}>{t("pujari.menu.profile")}</Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && pendingAcceptance.length > 0 && (
          <Card className="border-2 border-orange-300 bg-orange-50/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2">
                <AlertCircle className="text-orange-600" size={20} />
                Pending acceptance ({pendingAcceptance.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingAcceptance.slice(0, DASHBOARD_LIST_LIMIT).map((row) => (
                <BookingListItem key={row.booking.id} row={row} showAcceptReject />
              ))}
              {pendingAcceptance.length > DASHBOARD_LIST_LIMIT && (
                <Button variant="outline" size="sm" onClick={() => setLocation("/pujari/bookings?tab=upcoming&status=pending")}>
                  More ({pendingAcceptance.length - DASHBOARD_LIST_LIMIT})
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && readyToStart.length > 0 && (
          <Card className="border border-blue-200 bg-blue-50/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-foreground">Ready to start (OTP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {readyToStart.slice(0, DASHBOARD_LIST_LIMIT).map((row) => (
                <BookingListItem key={row.booking.id} row={row} />
              ))}
              {readyToStart.length > DASHBOARD_LIST_LIMIT && (
                <Button variant="outline" size="sm" onClick={() => setLocation("/pujari/bookings?tab=upcoming&status=confirmed")}>
                  More ({readyToStart.length - DASHBOARD_LIST_LIMIT})
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <WalletPanel variant="priest" />

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <CalendarIcon size={18} className="text-primary" />
                Booking Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{ booked: bookingDates }}
                modifiersClassNames={{
                  booked: "bg-primary/20 text-primary font-bold rounded-md",
                }}
                className="rounded-md border border-border"
              />
              <p className="text-xs text-muted-foreground mt-3">
                Highlighted dates have assigned bookings.
              </p>

              <div className="mt-6 space-y-2">
                <h4 className="font-medium text-sm text-foreground">
                  {selectedDate ? formatDisplayDate(selectedDate) : "Select a date"}
                </h4>
                {isLoading && <Skeleton className="h-16 w-full" />}
                {!isLoading && dayBookings.length === 0 && (
                  <p className="text-muted-foreground text-sm">No bookings on this date.</p>
                )}
                {dayBookings.slice(0, DASHBOARD_LIST_LIMIT).map((row) => (
                  <BookingListItem key={row.booking.id} row={row} />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-foreground">Your Bookings</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLocation("/pujari/bookings")}>
                  View all
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs value={listTab} onValueChange={setListTab}>
                  <TabsList className="bg-secondary/30 mb-4 h-auto flex flex-wrap justify-start gap-1">
                    <TabsTrigger value="completed" className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                      <CheckCircle2 size={14} /> Completed ({completedOnly.length})
                    </TabsTrigger>
                    <TabsTrigger value="cancelled" className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                      Cancelled ({cancelledOnly.length})
                    </TabsTrigger>
                    <TabsTrigger value="expired" className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                      Expired ({expiredOnly.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="completed" className="space-y-3 mt-0">
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {!isLoading && completedOnly.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No completed bookings yet.
                      </p>
                    )}
                    {completedPreview.map((row) => (
                      <BookingListItem key={row.booking.id} row={row} />
                    ))}
                    {completedOnly.length > DASHBOARD_LIST_LIMIT && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setLocation("/pujari/bookings?tab=completed")}
                      >
                        More ({completedOnly.length - DASHBOARD_LIST_LIMIT})
                      </Button>
                    )}
                    {completedOnly.length > 0 && (
                      <div className="pt-3 border-t border-border flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed Dakshina</span>
                        <span className="font-semibold text-foreground">
                          {formatPaise(stats.completedEarnings)}
                        </span>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="cancelled" className="space-y-3 mt-0">
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {!isLoading && cancelledOnly.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No cancelled bookings.
                      </p>
                    )}
                    {cancelledPreview.map((row) => (
                      <BookingListItem key={row.booking.id} row={row} />
                    ))}
                    {cancelledOnly.length > DASHBOARD_LIST_LIMIT && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setLocation("/pujari/bookings?tab=cancelled")}
                      >
                        More ({cancelledOnly.length - DASHBOARD_LIST_LIMIT})
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="expired" className="space-y-3 mt-0">
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {!isLoading && expiredOnly.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No expired bookings.
                      </p>
                    )}
                    {expiredPreview.map((row) => (
                      <BookingListItem key={row.booking.id} row={row} />
                    ))}
                    {expiredOnly.length > DASHBOARD_LIST_LIMIT && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setLocation("/pujari/bookings?tab=expired")}
                      >
                        More ({expiredOnly.length - DASHBOARD_LIST_LIMIT})
                      </Button>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-border bg-secondary/20">
              <CardContent className="p-5 space-y-2">
                <div className="font-semibold text-foreground">Dakshina & settlements</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Accept pending bookings, start with customer OTP, then mark complete when finished so
                  settlements stay accurate. Past-dated unfinished bookings appear under Expired; cancelled
                  bookings have their own tab.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedBooking}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedBooking(null);
            setDetailIntent(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {detailIntent === "reject" ? "Reject booking" : selectedBooking?.pujaType.name}
            </DialogTitle>
            <DialogDescription>#{selectedBooking?.booking.bookingNumber}</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <BookingDetailPanel
              bookingId={selectedBooking.booking.id}
              role="pujari"
              initialIntent={detailIntent}
              seed={{
                status: selectedBooking.booking.status,
                service_name: selectedBooking.booking.serviceName,
                booking_number: selectedBooking.booking.bookingNumber,
                booking_date: selectedBooking.booking.bookingDate
                  ? String(selectedBooking.booking.bookingDate).slice(0, 10)
                  : undefined,
                start_time: selectedBooking.booking.bookingTime || undefined,
                location_label: selectedBooking.booking.location,
                package_type: selectedBooking.booking.tier,
                base_price_paise: selectedBooking.booking.basePrice,
                platform_fee_paise: selectedBooking.booking.platformFee,
                gst_amount_paise: selectedBooking.booking.gstAmount,
                total_paise: selectedBooking.booking.totalAmount,
                pujari_payable_paise: selectedBooking.booking.priestAmount,
                customer_name: selectedBooking.customer.name || undefined,
              }}
              onUpdated={async (info) => {
                await loadBookings();
                if (
                  info?.decision === "accepted" ||
                  info?.decision === "rejected" ||
                  info?.decision === "cancelled"
                ) {
                  setSelectedBooking(null);
                  setDetailIntent(null);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PujariDashboard() {
  return (
    <PujariPortal>
      <PujariDashboardContent />
    </PujariPortal>
  );
}
