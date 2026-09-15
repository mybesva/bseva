import { CustomerPortal } from "@/components/RolePortals";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
import ServiceAvailabilityBanner from "@/components/ServiceAvailabilityBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api, apiBookings } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import {
  BOOKING_UNAVAILABLE_HINT,
} from "@/lib/serviceAvailabilityMessages";
import { notifyBookingBlocked } from "@/lib/notifyBookingBlocked";
import { Calendar, MapPin, Clock, Sparkles, CreditCard, ArrowRight, PlayCircle, Video } from "lucide-react";
import PujariLiveTrackCard from "@/components/PujariLiveTrackCard";
import { formatDisplayDate } from "@/lib/formatDate";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import WalletPanel from "@/components/WalletPanel";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function CustomerDashboardContent() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { canBook, checking, status, refresh } = useServiceAvailability();
  const [calPref, setCalPref] = useState<"north" | "south" | "lunar">("north");
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pujas, setPujas] = useState<any[]>([]);
  const [panchang, setPanchang] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    // Soft refresh: reuse result from login / provider if still fresh (avoids a second GPS wait).
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const pref = (user?.calendar_preference as "north" | "south" | "lunar") || "north";
    setCalPref(pref);
  }, [user?.calendar_preference]);

  useEffect(() => {
    const qs = new URLSearchParams({ date: format(new Date(), "yyyy-MM-dd"), calendar: calPref });
    api(`/panchang?${qs}`).then(setPanchang).catch(() => setPanchang(null));
  }, [calPref]);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    setIsLoading(true);
    Promise.all([
      apiBookings(1, 50),
      api<any[]>("/services"),
    ])
      .then(([b, s]) => {
        setBookings(b.items);
        setPujas(s);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setIsLoading(false));
    api<{ items: any[] }>("/recommendations")
      .then((r) => setRecommendations(r.items || []))
      .catch(() => setRecommendations([]));
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-gray-100 text-gray-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const ongoingBookings = useMemo(() => {
    const now = Date.now();
    return (bookings || []).filter((b) => {
      if (b.status === "in_progress") return true;
      if (b.status !== "confirmed") return false;
      if (!b.booking_date) return true;
      const start = new Date(`${String(b.booking_date).slice(0, 10)}T${String(b.start_time || "00:00").slice(0, 5)}:00`);
      const ms = start.getTime() - now;
      // Show from 24h before through a bit after start
      return ms <= 24 * 60 * 60 * 1000 && ms >= -2 * 60 * 60 * 1000;
    });
  }, [bookings]);
  const [otpByBooking, setOtpByBooking] = useState<Record<string, { code?: string | null; available?: boolean; message?: string | null }>>({});

  useEffect(() => {
    const targets = (bookings || []).filter((b) => b.status === "confirmed" || b.status === "in_progress");
    if (!targets.length) return;
    let cancelled = false;
    void Promise.all(
      targets.map(async (b) => {
        try {
          const otp = await api<any>(`/bookings/${b.id}/start-otp`);
          return [String(b.id), otp] as const;
        } catch {
          return [String(b.id), null] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, any> = {};
      for (const [id, otp] of pairs) if (otp) next[id] = otp;
      setOtpByBooking(next);
    });
    return () => {
      cancelled = true;
    };
  }, [bookings]);

  return (
    <>
      <section className="bg-sidebar text-sidebar-foreground py-10 px-6 rounded-xl mb-8">
        <h1 className="text-h1 mb-2">{t("customer.welcome")}, {user?.name || "Customer"}</h1>
        <p className="text-sidebar-foreground/80">{t("customer.subtitle")}</p>
        {user?.public_id ? (
          <p className="mt-2 text-sm text-sidebar-foreground/70 font-mono">ID: {user.public_id}</p>
        ) : null}
      </section>
      <ServiceAvailabilityBanner />
      <PromoBannerCarousel />
      <div className="space-y-12">
        <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 text-foreground flex items-center gap-2">
                <PlayCircle className="text-blue-600" size={22} />
                {t("customer.ongoingPuja")}
              </h2>
              <Link href="/customer/bookings">
                <Button variant="outline" size="sm">{t("common.viewAll")}</Button>
              </Link>
            </div>
            <div className="space-y-4">
              {!isLoading && ongoingBookings.length === 0 ? (
                <Card className="border border-dashed">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No ongoing or upcoming confirmed pujas right now.
                  </CardContent>
                </Card>
              ) : null}
              {ongoingBookings.map((booking) => {
                const otp = otpByBooking[String(booking.id)];
                return (
                <Card key={booking.id} className="border-2 border-blue-200 bg-blue-50/40 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-foreground">{booking.service_name}</h3>
                          <Badge className={getStatusColor(booking.status)}>{booking.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">#{booking.booking_number}</p>
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
                            {booking.location_label || booking.mode}
                          </span>
                        </div>
                        {booking.status === "confirmed" && (
                          <div className="mt-3 rounded-md border border-blue-200 bg-white/70 px-3 py-2">
                            <p className="text-xs font-medium text-foreground mb-1">Puja start OTP</p>
                            {otp?.available && otp.code ? (
                              <p className="text-xl font-bold tracking-widest text-primary">{otp.code}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {otp?.message || "OTP appears 15 minutes before start. Share it with your pujari to begin."}
                              </p>
                            )}
                          </div>
                        )}
                        {booking.mode === "virtual" && (booking.meeting_url || booking.public_invite_url) && (
                          <div className="mt-3 rounded-lg border-2 border-blue-400 bg-white px-3 py-3 space-y-2">
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Video size={16} className="text-blue-600" />
                              Google Meet ready — join your virtual puja
                            </p>
                            {booking.meeting_url ? (
                              <Button asChild size="sm">
                                <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer">
                                  Join Google Meet
                                </a>
                              </Button>
                            ) : booking.public_invite_url ? (
                              <Button asChild size="sm" variant="outline">
                                <a href={booking.public_invite_url} target="_blank" rel="noopener noreferrer">
                                  Open invite page
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        )}
                        {booking.mode !== "virtual" &&
                          ["confirmed", "in_progress"].includes(String(booking.status || "")) && (
                            <div className="mt-3">
                              <PujariLiveTrackCard
                                bookingId={String(booking.id)}
                                destinationLat={booking.latitude}
                                destinationLng={booking.longitude}
                              />
                            </div>
                          )}
                      </div>
                      <Badge
                        variant="outline"
                        className="capitalize self-start md:self-center pointer-events-none select-none"
                        title="Package type"
                      >
                        {booking.package_type}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WalletPanel variant="customer" />
          <Card>
            <CardHeader>
              <CardTitle className="">{t("calendar.panchangam")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">{t("calendar.preference")}</Label>
                <Select
                  value={calPref}
                  onValueChange={(v) => {
                    const pref = v as "north" | "south" | "lunar";
                    setCalPref(pref);
                    void api("/auth/me", { method: "PATCH", body: JSON.stringify({ calendar_preference: pref }) });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="north">{t("calendar.north")}</SelectItem>
                    <SelectItem value="south">{t("calendar.south")}</SelectItem>
                    <SelectItem value="lunar">{t("calendar.lunar")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {panchang && (
                <div className="text-sm space-y-1 bg-orange-50 border border-orange-100 rounded-lg p-3">
                  <p><strong>Tithi:</strong> {panchang.tithi} ({panchang.paksha})</p>
                  <p><strong>Nakshatra:</strong> {panchang.nakshatra}</p>
                  <p><strong>Month:</strong> {panchang.lunarMonth} · Day {panchang.lunarDay}</p>
                  <p><strong>Rahu Kalam:</strong> {panchang.rahukaalam}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {recommendations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 text-foreground flex items-center gap-2">
                <Sparkles className="text-primary" size={22} />
                Recommended for you
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((rec) => (
                <Card key={rec.id} className="border-primary/30 bg-orange-50/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-foreground">{rec.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {rec.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{rec.description}</p>
                    )}
                    {rec.recurrence_hint && (
                      <p className="text-xs text-muted-foreground">{rec.recurrence_hint}</p>
                    )}
                    <div className="text-sm font-medium text-foreground">
                      {rec.service_name}
                      {rec.standard_price_paise
                        ? ` · From ₹${(rec.standard_price_paise / 100).toLocaleString("en-IN")}`
                        : ""}
                    </div>
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 font-bold"
                      disabled={!canBook || checking}
                      title={!canBook ? BOOKING_UNAVAILABLE_HINT : undefined}
                      onClick={() => {
                        if (!canBook || checking) {
                          notifyBookingBlocked(status);
                          return;
                        }
                        setLocation(`/book/${rec.service_slug}`);
                      }}
                    >
                      {checking ? "Checking…" : t("customer.bookNow")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Booking cards — services */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h2 text-foreground">{t("customer.bookServices")}</h2>
            <Link href="/services">
              <Button variant="outline" className="gap-2">
                View All <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(pujas || []).slice(0, 6).map((puja) => (
              <Card key={puja.id} className="hover:shadow-md transition-shadow border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <Sparkles className="text-primary" size={18} />
                    {puja.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{puja.description}</p>
                  <div className="text-sm font-medium text-foreground">
                    From ₹{((puja.standard_price_paise || 0) / 100).toLocaleString("en-IN")}
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 font-bold"
                    disabled={!canBook || checking}
                    title={!canBook ? BOOKING_UNAVAILABLE_HINT : undefined}
                    onClick={() => {
                      if (!canBook || checking) {
                        notifyBookingBlocked(status);
                        return;
                      }
                      setLocation(`/book/${puja.slug}`);
                    }}
                  >
                    {checking ? "Checking…" : t("customer.bookNow")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* My bookings */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h2 text-foreground">{t("customer.myBookings")}</h2>
            <Link href="/customer/bookings">
              <Button variant="outline">{t("common.viewAll")}</Button>
            </Link>
          </div>
          {isLoading && <Skeleton className="h-32 w-full" />}
          {!isLoading && (!bookings || bookings.length === 0) && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground mb-4">No bookings yet. Book a service above to get started.</p>
              </CardContent>
            </Card>
          )}
          <div className="space-y-4">
            {(bookings || [])
              .filter((b) => b.status !== "in_progress")
              .slice(0, 5)
              .map((booking) => (
              <Card key={booking.id} className="border-border">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg text-foreground">{booking.service_name}</h3>
                        <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">#{booking.booking_number}</p>
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
                          {booking.location_label || booking.mode}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard size={14} />
                          ₹{((booking.total_paise || 0) / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="capitalize pointer-events-none select-none"
                      title="Package type"
                    >
                      {booking.package_type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CustomerDashboard() {
  return (
    <CustomerPortal>
      <CustomerDashboardContent />
    </CustomerPortal>
  );
}
