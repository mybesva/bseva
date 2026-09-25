import { CustomerPortal } from "@/components/RolePortals";
import CustomerWelcomeHero, { customerGreetingName } from "@/components/CustomerWelcomeHero";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
import ServiceAvailabilityBanner from "@/components/ServiceAvailabilityBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, apiBookings } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import {
  BOOKING_UNAVAILABLE_HINT,
} from "@/lib/serviceAvailabilityMessages";
import { notifyBookingBlocked } from "@/lib/notifyBookingBlocked";
import { formatStartingFrom } from "@/lib/servicePricing";
import { serviceImageUrl } from "@/lib/serviceImage";
import ServiceCard from "@/components/ServiceCard";
import { PujaTitle } from "@/components/PujaTitle";
import { useStartBooking } from "@/hooks/useStartBooking";
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
function CustomerDashboardContent() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { canBook, checking, status } = useServiceAvailability();
  const { startBooking, bookingBlocked } = useStartBooking();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pujas, setPujas] = useState<any[]>([]);
  const [panchang, setPanchang] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    const qs = new URLSearchParams({ date: format(new Date(), "yyyy-MM-dd"), calendar: "lunar" });
    api(`/panchang?${qs}`).then(setPanchang).catch(() => setPanchang(null));
  }, []);

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
  const customerStatus = (booking: any) => booking.customer_display_status || booking.status;
  const customerStatusLabel = (booking: any) =>
    customerStatus(booking) === "confirmed"
      ? t("web.booking.confirmed")
      : t(`status.${customerStatus(booking)}`);

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
  const [completeCodeByBooking, setCompleteCodeByBooking] = useState<Record<string, string>>({});
  const [completeBusy, setCompleteBusy] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    const targets = (bookings || []).filter((b) => {
      if (b.status === "in_progress") return true;
      if (b.status !== "confirmed" || !b.booking_date) return false;
      const start = new Date(
        `${String(b.booking_date).slice(0, 10)}T${String(b.start_time || "00:00").slice(0, 5)}:00`,
      );
      const ms = start.getTime() - now;
      return ms <= 24 * 60 * 60 * 1000 && ms >= -2 * 60 * 60 * 1000;
    });
    if (!targets.length) return;
    let cancelled = false;
    async function loadOtps() {
      const pairs = await Promise.all(
        targets.map(async (b) => {
          try {
            const otp = await api<any>(`/bookings/${b.id}/start-otp`);
            return [String(b.id), otp] as const;
          } catch {
            return [String(b.id), null] as const;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, any> = {};
      for (const [id, otp] of pairs) if (otp) next[id] = otp;
      setOtpByBooking(next);
    }
    void loadOtps();
    const t = window.setInterval(() => void loadOtps(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [bookings]);

  return (
    <>
      <CustomerWelcomeHero
        customerName={customerGreetingName(user?.name, t("auth.customer"))}
        publicId={(user as { public_id?: string } | null)?.public_id}
      />
      <ServiceAvailabilityBanner virtualHref="/services" />
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
                    {t("web.customer.noOngoing")}
                  </CardContent>
                </Card>
              ) : null}
              {ongoingBookings.map((booking) => {
                const otp = otpByBooking[String(booking.id)];
                return (
                <Card key={booking.id} className="border-2 border-blue-200 bg-blue-50/40 shadow-sm">
                  <CardContent className="p-4 md:p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="text-lg">
                            <PujaTitle name={booking.service_name} />
                          </h3>
                          <Badge className={getStatusColor(customerStatus(booking))}>{customerStatusLabel(booking)}</Badge>
                          <Badge variant="outline" className="capitalize">{booking.package_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">#{booking.booking_number}</p>
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
                      </div>
                    </div>
                        {booking.status === "confirmed" && booking.pujari_id && (
                          <div className="rounded-md border border-blue-200 bg-white/70 px-3 py-2">
                            <p className="text-xs font-medium text-foreground mb-1">{t("otp.startTitle")}</p>
                            {otp?.available && otp.code ? (
                              <>
                                <p className="text-xl font-bold tracking-widest text-primary">{otp.code}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t("otp.startShare")}</p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {otp?.message || t("track.notAvailable")}
                              </p>
                            )}
                          </div>
                        )}
                        {booking.status === "in_progress" && (
                          <div className="rounded-md border border-primary/30 bg-white/80 px-3 py-2 space-y-2">
                            <p className="text-xs font-medium text-foreground">{t("otp.verifyComplete")}</p>
                            <p className="text-xs text-muted-foreground">{t("otp.completeEnter")}</p>
                            <div className="flex flex-wrap gap-2">
                              <Input
                                className="h-9 max-w-[160px] tracking-widest"
                                maxLength={8}
                                value={completeCodeByBooking[String(booking.id)] || ""}
                                onChange={(e) =>
                                  setCompleteCodeByBooking((prev) => ({ ...prev, [String(booking.id)]: e.target.value }))
                                }
                                placeholder="OTP"
                              />
                              <Button
                                size="sm"
                                disabled={completeBusy === String(booking.id) || (completeCodeByBooking[String(booking.id)] || "").trim().length < 4}
                                onClick={() => {
                                  const code = (completeCodeByBooking[String(booking.id)] || "").trim();
                                  setCompleteBusy(String(booking.id));
                                  api(`/bookings/${booking.id}/complete-otp/verify`, {
                                    method: "POST",
                                    body: JSON.stringify({ code }),
                                  })
                                    .then(() => {
                                      toast.success(t("otp.completeAction"));
                                      return apiBookings(1, 50);
                                    })
                                    .then((row) => setBookings(row.items))
                                    .catch((e: any) => toast.error(e.message || "Could not complete puja"))
                                    .finally(() => setCompleteBusy(null));
                                }}
                              >
                                {t("otp.completeAction")}
                              </Button>
                            </div>
                          </div>
                        )}
                        {booking.mode === "virtual" && (booking.meeting_url || booking.public_invite_url) && (
                          <div className="rounded-lg border-2 border-blue-400 bg-white px-3 py-3 space-y-2">
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Video size={16} className="text-blue-600" />
                              {t("web.dashboard.meetReady")}
                            </p>
                            {booking.meeting_url ? (
                              <Button asChild size="sm">
                                <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer">
                                  {t("web.meeting.join")}
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
                        {booking.mode !== "virtual" && Boolean(booking.pujari_id) && booking.status === "confirmed" && (
                          <PujariLiveTrackCard
                            bookingId={String(booking.id)}
                            destinationLat={booking.latitude}
                            destinationLng={booking.longitude}
                          />
                        )}
                  </CardContent>
                </Card>
              );
              })}
            </div>
          </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-2 border-2 border-primary/50 bg-gradient-to-br from-orange-50 via-background to-orange-50/40 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl md:text-3xl text-primary flex items-center gap-2">
                <Calendar size={28} />
                {t("calendar.panchangam")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {panchang ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-primary/25 bg-white/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("calendar.tithi")}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{panchang.tithi} ({panchang.paksha})</p>
                  </div>
                  <div className="rounded-xl border border-primary/25 bg-white/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("calendar.nakshatra")}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{panchang.nakshatra}</p>
                  </div>
                  <div className="rounded-xl border border-primary/25 bg-white/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("calendar.lunarMonth")}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{panchang.lunarMonth} · {t("calendar.lunarDay", { day: panchang.lunarDay })}</p>
                  </div>
                  <div className="rounded-xl border-2 border-primary bg-primary/10 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("calendar.rahuKalam")}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{panchang.rahukaalam}</p>
                  </div>
                </div>
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </CardContent>
          </Card>
          <WalletPanel variant="customer" compact />
        </div>

        {recommendations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 text-foreground flex items-center gap-2">
                <Sparkles className="text-primary" size={22} />
                Recommended for you
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {recommendations.map((rec) => (
                <Card key={rec.id} className="border-primary/30 bg-orange-50/40 h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-foreground line-clamp-2 min-h-[3.5rem]">{rec.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col space-y-4">
                    {rec.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-3 min-h-[3.75rem]">{rec.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground min-h-[3.75rem]" />
                    )}
                    {rec.recurrence_hint ? (
                      <p className="text-xs text-muted-foreground">{rec.recurrence_hint}</p>
                    ) : null}
                    <div className="mt-auto space-y-3">
                      <div className="text-sm font-medium text-foreground space-y-1">
                        <PujaTitle name={rec.service_name} className="block" />
                        {(() => {
                          const line = formatStartingFrom(rec);
                          return line ? <p className="text-primary">{line}</p> : null;
                        })()}
                      </div>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 font-bold"
                        disabled={!canBook || checking}
                        title={!canBook ? t(BOOKING_UNAVAILABLE_HINT) : undefined}
                        onClick={() => {
                          if (!canBook || checking) {
                            notifyBookingBlocked(status, t);
                            return;
                          }
                          setLocation(`/book/${rec.service_slug}`);
                        }}
                      >
                        {checking ? "Checking…" : t("customer.bookNow")}
                      </Button>
                    </div>
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
              <div
                key={puja.id}
                onClick={() => setLocation(`/services/${puja.slug}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLocation(`/services/${puja.slug}`);
                  }
                }}
                role="link"
                tabIndex={0}
                className="cursor-pointer min-w-0 h-full"
              >
                <ServiceCard
                  title={puja.name}
                  description={puja.short_description || puja.description || ""}
                  startingFrom={formatStartingFrom(puja)}
                  image={serviceImageUrl(puja)}
                  comingSoon={!puja.bookable}
                  bookingDisabled={Boolean(puja.bookable && bookingBlocked)}
                  bookingDisabledLabel={checking ? t("services.checkingAvailability") : t("services.bookingUnavailableArea")}
                  onReadMore={() => setLocation(`/services/${puja.slug}`)}
                  onBookNow={() => startBooking(puja.slug)}
                />
              </div>
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
                        <h3 className="text-lg">
                          <PujaTitle name={booking.service_name} />
                        </h3>
                        <Badge className={getStatusColor(customerStatus(booking))}>{customerStatusLabel(booking)}</Badge>
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
