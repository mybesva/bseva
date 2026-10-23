import { PujaTitle } from "@/components/PujaTitle";
import { PujariPortal } from "@/components/RolePortals";
import BookingDetailPanel from "@/components/BookingDetailPanel";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
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
  compareByPujaSchedule,
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
  CheckCircle2,
  Hourglass,
  PlayCircle,
  Inbox,
  Video,
  BellRing,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { format, isSameDay, isSameMonth } from "date-fns";
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
  const [listTab, setListTab] = useState("upcoming");
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
      requestCount: rows.filter(
        (r) => ["pending", "pending_acceptance"].includes(r.booking.status) && !isExpiredBooking(r, now)
      ).length,
      scheduledCount: upcoming.filter((r) => !["pending", "pending_acceptance"].includes(r.booking.status)).length,
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
      rows
        .filter(
          (r) =>
            ["pending", "pending_acceptance"].includes(r.booking.status) &&
            !isExpiredBooking(r, now)
        )
        .sort((a, b) => compareByPujaSchedule(a, b, "asc")),
    [rows, now]
  );

  const readyToStart = useMemo(
    () =>
      rows.filter(
        (r) => r.booking.status === "confirmed" && !isExpiredBooking(r, now)
      ),
    [rows]
  );

  // Accepted, scheduled pujas only. Pending requests are listed once, under "New Puja Requests".
  const upcoming = useMemo(() => {
    return rows
      .filter((b) => isUpcomingBooking(b, now) && !["pending", "pending_acceptance"].includes(b.booking.status))
      .sort((a, b) => compareByPujaSchedule(a, b, "asc"));
  }, [rows, now]);

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

  // Booking requests is the call to action (opens Bookings filtered to pending, where the pujari
  // can accept or reject). Dakshina is a single card: this month, with the running total underneath.
  const metricCards = [
    {
      title: t("pd.requests"),
      value: String(stats.requestCount),
      hint: stats.requestCount > 0 ? t("pd.requestsHint") : t("pd.requestsNone"),
      icon: BellRing,
      color: "text-orange-600",
      bg: "bg-orange-100",
      href: "/pujari/bookings?tab=upcoming&status=pending",
      highlight: stats.requestCount > 0,
    },
    {
      title: t("mobile.upcoming"),
      value: String(stats.scheduledCount),
      hint: t("pd.upcomingHint"),
      icon: CalendarIcon,
      color: "text-blue-600",
      bg: "bg-blue-100",
      href: "/pujari/bookings?tab=upcoming&status=confirmed",
    },
    {
      title: t("pd.dakshina"),
      value: formatPaise(stats.monthEarnings),
      hint: t("pd.dakshinaTotal", { amount: formatPaise(stats.totalEarnings) }),
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-100",
      href: "/pujari/earnings",
    },
    {
      title: t("pd.completed"),
      value: String(stats.completedCount),
      hint: `${formatPaise(stats.completedEarnings)} earned`,
      icon: CheckCircle2,
      color: "text-emerald-700",
      bg: "bg-emerald-100",
      href: "/pujari/bookings?tab=completed",
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
      <div className="w-full rounded-2xl border border-[#EFE2CF] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#FF7A00]/50 hover:shadow-[0_14px_28px_-22px_rgba(255,122,0,0.6)] dark:border-white/10 dark:bg-[#152238]">
        <button type="button" onClick={() => openDetail(null)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                <PujaTitle name={row.pujaType.name} className="min-w-0" nameClassName="truncate" />
                {row.booking.samagriRequested ? (
                  <Badge className="bg-orange-100 text-orange-900 border-orange-200 text-[10px] uppercase tracking-wide">
                    Samagri Selected
                  </Badge>
                ) : null}
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
                  {row.booking.indiaLocal || row.booking.bookingTime || "—"}
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
                    {t("web.dashboard.meetReadyShort")}
                  </p>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(row.booking.meetingUrl!, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {t("web.meeting.join")}
                  </Button>
                </div>
              )}
            </div>
            <Badge className={statusBadgeClass(shown)}>
              {t(shown === "expired" ? "web.status.expired" : `status.${shown}`)}
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
      <section className="relative isolate mb-6 overflow-hidden rounded-3xl bg-[#071A33] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-full bg-cover bg-[position:70%_35%] opacity-50 sm:w-[60%] sm:opacity-100"
          style={{ backgroundImage: "url(/images/landing/pujari-portrait.jpg)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#071A33_0%,#071A33_42%,rgba(7,26,51,0.6)_62%,rgba(7,26,51,0.05)_100%)]"
        />
        <div className="relative max-w-[40rem] p-6 sm:p-8 lg:p-9">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FF7A00]">{t("auth.pujari")}</p>
          <h1 className="mt-2 font-display text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] font-semibold leading-tight">
            Namaste, <span className="text-[#FF9A2E]">{user?.name}</span>
          </h1>
          <p className="mt-2 text-[15px] text-white/80">{t("priest.subtitle")}</p>
          {user?.public_id ? (
            <p className="mt-1 font-mono text-xs text-white/55">ID: {user.public_id}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              className="h-11 rounded-xl bg-[#FF7A00] px-5 font-bold text-[#0E1830] hover:bg-[#FF8A1F]"
              onClick={() => setLocation("/pujari/bookings")}
            >
              {t("nav.bookings")}
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-white/50 bg-transparent px-5 font-bold text-white hover:bg-white/10 hover:text-white"
              onClick={() => setLocation("/pujari/availability")}
            >
              {t("nav.availability")}
            </Button>
          </div>
        </div>
      </section>
      <PromoBannerCarousel />

      <div className="space-y-6">
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
                <button
                  key={m.title}
                  type="button"
                  onClick={() => setLocation(m.href)}
                  className={`group flex items-center gap-4 rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] ${
                    m.highlight
                      ? "border-[#E86A00] bg-gradient-to-br from-[#FF8A1F] to-[#E86A00] text-white shadow-[0_18px_36px_-18px_rgba(232,106,0,0.9)]"
                      : "border-[#EFE2CF] bg-card shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] hover:border-[#FF7A00]/40 dark:border-white/10"
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.highlight ? "bg-white/20" : m.bg}`}
                  >
                    <m.icon className={`h-6 w-6 ${m.highlight ? "text-white" : m.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[12px] font-bold uppercase tracking-[0.1em] ${m.highlight ? "text-white/90" : "text-muted-foreground"}`}
                    >
                      {m.title}
                    </p>
                    <p className={`text-2xl font-extrabold leading-tight ${m.highlight ? "text-white" : "text-foreground"}`}>{m.value}</p>
                    <p className={`truncate text-xs ${m.highlight ? "text-white/85" : "text-muted-foreground"}`}>{m.hint}</p>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${m.highlight ? "text-white/80" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
        </div>

        <Card className="overflow-hidden rounded-3xl border border-[#EFE2CF] shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1E2] text-[#FF7A00] dark:bg-[#FF7A00]/15">
                <PlayCircle size={18} />
              </span>
              {t("priest.ongoingPuja")}
              {!isLoading && ongoing.length > 0 ? (
                <Badge className="ml-1 bg-[#FF7A00] text-white">{ongoing.length}</Badge>
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

        <Card
          className={
            !isLoading && pendingAcceptance.length > 0
              ? "rounded-3xl border-2 border-[#FF7A00]/40 bg-[#FFF8F0] shadow-[0_22px_40px_-30px_rgba(255,122,0,0.55)] dark:bg-[#FF7A00]/[0.06]"
              : "rounded-3xl border border-[#EFE2CF] shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10"
          }
        >
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A00] text-white">
                <Inbox className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-foreground text-lg leading-tight">
                  New booking requests
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  {isLoading
                    ? "Loading requests…"
                    : pendingAcceptance.length > 0
                      ? "Accept or decline to confirm your schedule"
                      : "Fresh customer bookings appear here first"}
                </p>
              </div>
              {!isLoading && pendingAcceptance.length > 0 ? (
                <Badge className="bg-primary/15 text-primary border-primary/20 shrink-0">
                  {pendingAcceptance.length} new
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3 max-h-[26rem]">
                <Skeleton className="h-[7.5rem] w-full rounded-lg" />
                <Skeleton className="h-[7.5rem] w-full rounded-lg" />
                <Skeleton className="h-[7.5rem] w-full rounded-lg" />
              </div>
            ) : pendingAcceptance.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Inbox className="h-7 w-7 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">No bookings available</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                  You&apos;re all set for now. When a customer books a puja, the request will show
                  here so you can review and accept it.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="max-h-[26rem] overflow-y-auto space-y-3 pr-1 overscroll-contain"
                  aria-label="New booking requests list"
                >
                  {pendingAcceptance.map((row) => (
                    <BookingListItem key={row.booking.id} row={row} showAcceptReject />
                  ))}
                </div>
                {pendingAcceptance.length > 3 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-primary"
                    onClick={() => setLocation("/pujari/bookings?tab=upcoming&status=pending")}
                  >
                    View all {pendingAcceptance.length} requests in Bookings
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {!isLoading && readyToStart.length > 0 && (
          <Card className="rounded-3xl border border-[#BFD3EE] bg-[#F1F6FD] dark:border-white/10 dark:bg-white/5">
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

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 rounded-3xl border border-[#EFE2CF] shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10">
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
            <Card className="rounded-3xl border border-[#EFE2CF] shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] dark:border-white/10">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-foreground">Your Bookings</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLocation("/pujari/bookings")}>
                  View all
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs value={listTab} onValueChange={setListTab}>
                  <TabsList className="bg-secondary/30 mb-4 h-auto flex flex-wrap justify-start gap-1">
                    <TabsTrigger value="upcoming" className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                      <Hourglass size={14} /> Upcoming ({upcoming.length})
                    </TabsTrigger>
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

                  <TabsContent value="upcoming" className="space-y-3 mt-0">
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {!isLoading && upcoming.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No upcoming pujas scheduled. New requests appear under New booking requests
                        above.
                      </p>
                    )}
                    {upcoming.slice(0, DASHBOARD_LIST_LIMIT).map((row) => (
                      <BookingListItem
                        key={row.booking.id}
                        row={row}
                        showAcceptReject={
                          ["pending", "pending_acceptance"].includes(row.booking.status) &&
                          !isExpiredBooking(row, now)
                        }
                      />
                    ))}
                    {upcoming.length > DASHBOARD_LIST_LIMIT && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setLocation("/pujari/bookings?tab=upcoming")}
                      >
                        More ({upcoming.length - DASHBOARD_LIST_LIMIT})
                      </Button>
                    )}
                  </TabsContent>

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

            <Card className="rounded-3xl border-0 bg-[#071A33] text-white">
              <CardContent className="p-5 space-y-2">
                <div className="font-semibold text-[#FF9A2E]">Dakshina & settlements</div>
                <p className="text-sm text-white/80 leading-relaxed">
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
        <DialogContent className="flex max-h-[min(90vh,900px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="shrink-0 space-y-1.5 border-b px-6 py-4">
            <DialogHeader className="text-left">
              <DialogTitle className="text-foreground">
                {detailIntent === "reject" ? (
                  "Reject booking"
                ) : selectedBooking ? (
                  <PujaTitle name={selectedBooking.pujaType.name} as="span" />
                ) : null}
              </DialogTitle>
              <DialogDescription>#{selectedBooking?.booking.bookingNumber}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
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
                // Close first so the dialog doesn't hang open while the list reloads.
                if (
                  info?.decision === "accepted" ||
                  info?.decision === "rejected" ||
                  info?.decision === "cancelled"
                ) {
                  setSelectedBooking(null);
                  setDetailIntent(null);
                }
                await loadBookings();
              }}
            />
          )}
          </div>
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
