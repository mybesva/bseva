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
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  User,
  Sparkles,
  IndianRupee,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  History,
  PlayCircle,
  AlertCircle,
} from "lucide-react";
import { format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import WalletPanel from "@/components/WalletPanel";
import { useI18n } from "@/i18n/I18nProvider";

type BookingRow = {
  booking: {
    id: string;
    bookingNumber: string;
    bookingDate: Date | string | null;
    bookingTime: string | null;
    location: string;
    city: string | null;
    status: string;
    tier: string;
    totalAmount: number;
    priestAmount: number;
    platformFee: number;
    basePrice: number;
    gstAmount: number;
    specialInstructions: string | null;
    customerName: string | null;
    serviceName: string;
  };
  pujaType: { name: string; estimatedDuration: number };
  customer: { name: string | null; email: string | null; phone: string | null };
};

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function PujariDashboardContent() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [listTab, setListTab] = useState("upcoming");
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pujariProfile, setPujariProfile] = useState<any>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  async function loadBookings() {
    const rows = await api<any[]>("/bookings");
    setBookings(rows);
  }

  useEffect(() => {
    if (!user || (user.role !== "pujari" && user.role !== "head_pujari" && user.role !== "admin" && user.role !== "super_admin")) return;
    setIsLoading(true);
    Promise.all([
      loadBookings(),
      user.role === "pujari" || user.role === "head_pujari"
        ? api<any>("/pujari/profile").then(setPujariProfile)
        : Promise.resolve(),
      user.role === "pujari" || user.role === "head_pujari"
        ? api<{ referral_code: string }>("/pujari/referral-code")
            .then((r) => setReferralCode(r.referral_code))
            .catch(() => setReferralCode(null))
        : Promise.resolve(),
    ])
      .catch((e) => toast.error(e.message))
      .finally(() => setIsLoading(false));
  }, [user]);

  const rows = (bookings || []).map((b) => {
    const base = Number(b.base_price_paise || 0);
    const platform = Number(b.platform_fee_paise || Math.round(base * 0.15));
    const priestAmount = Number(b.pujari_payable_paise || base - platform);
    return {
      booking: {
        id: String(b.id),
        bookingNumber: b.booking_number,
        bookingDate: b.booking_date,
        bookingTime: b.start_time,
        location: b.location_label,
        city: b.location_label,
        status: b.status,
        tier: b.package_type,
        totalAmount: b.total_paise,
        priestAmount,
        platformFee: platform,
        basePrice: base,
        gstAmount: Number(b.gst_amount_paise || 0),
        specialInstructions: null,
        customerName: b.customer_name,
        serviceName: b.service_name,
      },
      pujaType: { name: b.service_name, estimatedDuration: 90 },
      customer: { name: b.customer_name, email: null, phone: null },
    };
  }) as BookingRow[];
  const now = new Date();
  const monthStart = startOfMonth(now);

  const stats = useMemo(() => {
    const completed = rows.filter((r) => r.booking.status === "completed");
    const upcoming = rows.filter(
      (r) =>
        r.booking.bookingDate &&
        new Date(r.booking.bookingDate) >= now &&
        !["cancelled", "completed", "refunded"].includes(r.booking.status)
    );
    const pending = rows.filter((r) =>
      ["pending", "pending_acceptance", "confirmed"].includes(r.booking.status)
    );

    const earningStatuses = ["completed", "confirmed", "in_progress"];
    const totalEarnings = rows
      .filter((r) => earningStatuses.includes(r.booking.status))
      .reduce((sum, r) => sum + (r.booking.priestAmount || 0), 0);

    const monthEarnings = rows
      .filter(
        (r) =>
          earningStatuses.includes(r.booking.status) &&
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
    () => rows.filter((r) => ["pending", "pending_acceptance"].includes(r.booking.status)),
    [rows]
  );

  const needsAction = useMemo(
    () =>
      rows.filter((r) =>
        ["pending", "pending_acceptance", "confirmed", "in_progress"].includes(r.booking.status)
      ),
    [rows]
  );

  const upcoming = useMemo(() => {
    return rows
      .filter((b) => b.booking.bookingDate && new Date(b.booking.bookingDate) >= now)
      .filter((b) => !["cancelled", "completed", "refunded"].includes(b.booking.status))
      .sort(
        (a, b) =>
          new Date(a.booking.bookingDate!).getTime() - new Date(b.booking.bookingDate!).getTime()
      );
  }, [rows]);

  const past = useMemo(() => {
    return rows
      .filter(
        (b) =>
          ["completed", "cancelled", "refunded"].includes(b.booking.status) ||
          (b.booking.bookingDate && new Date(b.booking.bookingDate) < now)
      )
      .sort(
        (a, b) =>
          new Date(b.booking.bookingDate || 0).getTime() -
          new Date(a.booking.bookingDate || 0).getTime()
      );
  }, [rows]);

  const ongoing = useMemo(
    () => rows.filter((r) => r.booking.status === "in_progress"),
    [rows]
  );

  const getStatusColor = (status: string) => {
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
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const statusLabels: Record<string, string> = {
    profile_incomplete: "Profile Incomplete",
    ready_for_submission: "Ready for Submission",
    submitted: "Submitted",
    under_review: "Under Review",
    verified: "Verified",
    rejected: "Rejected / Resubmission Required",
  };
  const profileStatus = pujariProfile?.profile_status || "profile_incomplete";

  const metricCards = [
    {
      title: "Total Earnings",
      value: formatPaise(stats.totalEarnings),
      hint: "Your share from confirmed & completed pujas",
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

  const actionHint = (status: string) => {
    if (status === "pending" || status === "pending_acceptance") return "Accept required";
    if (status === "confirmed") return "Start with OTP";
    if (status === "in_progress") return "Complete when done";
    return null;
  };

  const BookingListItem = ({ row }: { row: BookingRow }) => {
    const hint = actionHint(row.booking.status);
    return (
      <button
        type="button"
        onClick={() => setSelectedBooking(row)}
        className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-sidebar flex items-center gap-2">
              <Sparkles size={16} className="text-primary shrink-0" />
              <span className="truncate">{row.pujaType.name}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <CalendarIcon size={14} />
                {row.booking.bookingDate
                  ? format(new Date(row.booking.bookingDate), "dd MMM yyyy")
                  : "—"}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {row.booking.bookingTime || "—"}
              </span>
              <span className="flex items-center gap-1">
                <User size={14} />
                {row.customer.name}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {row.booking.city || "—"}
              </span>
            </div>
            <div className="text-sm font-medium text-primary mt-2">
              Your share: {formatPaise(row.booking.priestAmount || 0)}
            </div>
            {hint && <p className="text-xs text-orange-700 mt-1 font-medium">{hint}</p>}
          </div>
          <Badge className={getStatusColor(row.booking.status)}>{row.booking.status.replace(/_/g, " ")}</Badge>
        </div>
      </button>
    );
  };

  return (
    <>
      <section className="bg-sidebar text-sidebar-foreground py-10 px-6 rounded-xl mb-6">
        <h1 className="font-heading text-3xl font-bold mb-2">{t("priest.dashboard")}</h1>
        <p className="text-sidebar-foreground/80">Namaste, {user?.name}. {t("priest.subtitle")}</p>
      </section>

      <div className="space-y-8">
        <Card className="border-primary/30">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Verification status</p>
              <p className="font-heading font-semibold text-lg">{statusLabels[profileStatus] || profileStatus}</p>
            </div>
            {(profileStatus === "profile_incomplete" || profileStatus === "ready_for_submission") && (
              <Button size="sm" onClick={() => setLocation("/pujari/onboarding")}>Complete Profile</Button>
            )}
          </CardContent>
        </Card>
        {referralCode && (
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your referral code</p>
                <p className="font-heading font-semibold text-lg tracking-wide">{referralCode}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(referralCode);
                  toast.success("Referral code copied");
                }}
              >
                Copy
              </Button>
            </CardContent>
          </Card>
        )}
        {(profileStatus === "profile_incomplete" || !pujariProfile?.profile_submitted_at) && (
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
              <CardTitle className="font-heading text-sidebar flex items-center gap-2">
                <AlertCircle className="text-orange-600" size={20} />
                Pending acceptance ({pendingAcceptance.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingAcceptance.map((row) => (
                <BookingListItem key={row.booking.id} row={row} />
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && ongoing.length > 0 && (
          <Card className="border-2 border-blue-200 bg-blue-50/40 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-sidebar flex items-center gap-2">
                <PlayCircle className="text-blue-600" size={20} />
                {t("priest.ongoingPuja")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ongoing.map((row) => (
                <BookingListItem key={row.booking.id} row={row} />
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && needsAction.filter((r) => r.booking.status === "confirmed").length > 0 && (
          <Card className="border border-blue-200 bg-blue-50/20">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base text-sidebar">Ready to start (OTP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {needsAction
                .filter((r) => r.booking.status === "confirmed")
                .map((row) => (
                  <BookingListItem key={row.booking.id} row={row} />
                ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {metricCards.map((m) => (
              <Card key={m.title} className="border-none shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-lg ${m.bg}`}>
                      <m.icon className={`w-5 h-5 ${m.color}`} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{m.title}</p>
                  <p className="text-2xl font-bold text-sidebar">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.hint}</p>
                </CardContent>
              </Card>
            ))}
        </div>

        <WalletPanel variant="priest" />

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-border shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-sidebar flex items-center gap-2">
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
                <h4 className="font-medium text-sm text-sidebar">
                  {selectedDate ? format(selectedDate, "dd MMM yyyy") : "Select a date"}
                </h4>
                {isLoading && <Skeleton className="h-16 w-full" />}
                {!isLoading && dayBookings.length === 0 && (
                  <p className="text-muted-foreground text-sm">No bookings on this date.</p>
                )}
                {dayBookings.map((row) => (
                  <BookingListItem key={row.booking.id} row={row} />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-sidebar">Your Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={listTab} onValueChange={setListTab}>
                  <TabsList className="bg-secondary/30 mb-4">
                    <TabsTrigger value="upcoming" className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                      <Hourglass size={14} /> Upcoming ({upcoming.length})
                    </TabsTrigger>
                    <TabsTrigger value="past" className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                      <History size={14} /> Past ({past.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upcoming" className="space-y-3 mt-0">
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {!isLoading && upcoming.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No upcoming bookings. New customer bookings will appear here.
                      </p>
                    )}
                    {upcoming.map((row) => (
                      <BookingListItem key={row.booking.id} row={row} />
                    ))}
                  </TabsContent>

                  <TabsContent value="past" className="space-y-3 mt-0">
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {!isLoading && past.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No past bookings yet.
                      </p>
                    )}
                    {past.map((row) => (
                      <BookingListItem key={row.booking.id} row={row} />
                    ))}
                    {past.length > 0 && (
                      <div className="pt-3 border-t border-border flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed earnings</span>
                        <span className="font-semibold text-sidebar">
                          {formatPaise(stats.completedEarnings)}
                        </span>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-border bg-secondary/20">
              <CardContent className="p-5 space-y-2">
                <div className="font-heading font-semibold text-sidebar">Earnings & settlements</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Accept pending bookings, start with customer OTP, then mark complete when finished so
                  settlements stay accurate.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-sidebar">
              {selectedBooking?.pujaType.name}
            </DialogTitle>
            <DialogDescription>#{selectedBooking?.booking.bookingNumber}</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <BookingDetailPanel
              bookingId={selectedBooking.booking.id}
              role="pujari"
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
              onUpdated={async () => {
                await loadBookings();
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
