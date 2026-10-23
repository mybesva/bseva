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
import { Calendar, MapPin, Clock, Sparkles, ArrowRight, PlayCircle, Video, Flower2, Wallet } from "lucide-react";
import PujariLiveTrackCard from "@/components/PujariLiveTrackCard";
import { formatDisplayDate } from "@/lib/formatDate";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import PanchangCard from "@/components/PanchangCard";
import { displayTokenLabel, pujaServicesOnly, translatedTokenLabel } from "@bseva/config";
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
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== "customer") {
      setBookings([]);
      return;
    }
    const uid = String(user.id);
    setIsLoading(true);
    setBookings([]);
    Promise.all([
      apiBookings(1, 50),
      api<any[]>("/services"),
    ])
      .then(([b, s]) => {
        setBookings(
          (b.items || []).filter((row: any) => String(row.customer_id || "") === uid),
        );
        setPujas(s);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setIsLoading(false));
    api<{ items: any[] }>("/recommendations")
      .then((r) => setRecommendations(r.items || []))
      .catch(() => setRecommendations([]));
  }, [user?.id, user?.role]);

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

  const visibleBookings = (bookings || []).filter((b) => b.status !== "in_progress").slice(0, 5);

  return (
    <>
      <CustomerWelcomeHero
        customerName={customerGreetingName(user?.name, t("auth.customer"))}
        publicId={(user as { public_id?: string } | null)?.public_id}
      />
      <ServiceAvailabilityBanner virtualHref="/services" />

      <div className="mt-6 space-y-6">
        <SectionCard
          icon={<PlayCircle size={18} />}
          title={t("customer.ongoingPuja")}
          action={<ViewAllLink href="/customer/bookings" label={t("common.viewAll")} />}
        >
          {!isLoading && ongoingBookings.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#EFE2CF] bg-[#FFFBF5] px-5 py-6 text-sm font-medium text-muted-foreground dark:border-white/10 dark:bg-transparent">
              {t("web.customer.noOngoing")}
            </p>
          ) : null}
          <div className="divide-y divide-[#EFE2CF] dark:divide-white/10 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
            {ongoingBookings.map((booking) => {
              const otp = otpByBooking[String(booking.id)];
              const showStartOtp = booking.status === "confirmed" && booking.pujari_id;
              return (
                <div key={booking.id} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={customerStatus(booking)} label={customerStatusLabel(booking)} />
                      <span className="rounded-full bg-[#FFF1E2] px-2.5 py-1 text-[11.5px] font-extrabold text-[#C25E00] dark:bg-[#FF7A00]/15 dark:text-[#FFB066]">
                        {translatedTokenLabel(t(`booking.${booking.package_type}`), `booking.${booking.package_type}`, booking.package_type, "")}
                      </span>
                      <span className="rounded-full bg-[#EEF1F6] px-2.5 py-1 font-mono text-[11.5px] font-bold text-[#2E4A6F] dark:bg-white/10 dark:text-white/80">
                        #{booking.booking_number}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-foreground">
                      <PujaTitle name={booking.service_name} />
                    </h3>
                    <div className="grid gap-2 text-sm font-semibold text-muted-foreground sm:grid-cols-2">
                      <span className="flex items-center gap-2"><Calendar size={16} className="text-[#FF7A00]" />{formatDisplayDate(booking.booking_date)}</span>
                      <span className="flex items-center gap-2"><Clock size={16} className="text-[#FF7A00]" />{booking.start_time || "—"}</span>
                      <span className="flex items-center gap-2 sm:col-span-2"><MapPin size={16} className="text-[#FF7A00]" />{booking.location_label || displayTokenLabel(booking.mode, "")}</span>
                    </div>

                    {booking.status === "in_progress" && (
                      <div className="space-y-2 rounded-2xl border border-[#FFD2A6] bg-[#FFF6EC] px-4 py-3 dark:border-[#FF7A00]/30 dark:bg-[#FF7A00]/10">
                        <p className="text-sm font-bold text-foreground">{t("otp.verifyComplete")}</p>
                        <p className="text-xs text-muted-foreground">{t("otp.completeEnter")}</p>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            className="h-10 max-w-[170px] bg-white tracking-[0.3em] dark:bg-transparent"
                            maxLength={8}
                            value={completeCodeByBooking[String(booking.id)] || ""}
                            onChange={(e) =>
                              setCompleteCodeByBooking((prev) => ({ ...prev, [String(booking.id)]: e.target.value }))
                            }
                            placeholder="OTP"
                          />
                          <Button
                            className="h-10 font-bold"
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
                      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#BFD3EE] bg-[#F1F6FD] px-4 py-3 dark:border-white/15 dark:bg-white/5">
                        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <Video size={17} className="text-[#2E4A6F] dark:text-[#7AA2D4]" />
                          {t("web.dashboard.meetReady")}
                        </p>
                        {booking.meeting_url ? (
                          <Button asChild size="sm" className="ml-auto font-bold">
                            <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer">{t("web.meeting.join")}</a>
                          </Button>
                        ) : booking.public_invite_url ? (
                          <Button asChild size="sm" variant="outline" className="ml-auto">
                            <a href={booking.public_invite_url} target="_blank" rel="noopener noreferrer">Open invite page</a>
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
                  </div>

                  {showStartOtp ? (
                    <div className="flex flex-col justify-between gap-4 self-start rounded-2xl bg-[#071A33] p-5 text-white">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#FF7A00]">{t("otp.startTitle")}</p>
                        {otp?.available && otp.code ? (
                          <div className="mt-3 flex flex-wrap gap-2" aria-label={otp.code}>
                            {String(otp.code).split("").map((ch, i) => (
                              <span
                                key={i}
                                className="flex h-12 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/50 bg-white/[0.07] text-2xl font-extrabold"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-xs leading-relaxed text-white/75">
                        {otp?.available && otp.code ? t("otp.startShare") : otp?.message || t("track.notAvailable")}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <PanchangCard />
          <div className="min-w-0 space-y-6">
            <PromoBannerCarousel />
            <WalletRewardsSummary />
          </div>
        </div>

        {recommendations.length > 0 && (
          <SectionCard icon={<Sparkles size={18} />} title="Recommended for you">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex h-full flex-col rounded-2xl border border-[#FFD9B3] bg-gradient-to-br from-[#FFF4E8] to-white p-5 dark:border-[#FF7A00]/25 dark:from-[#FF7A00]/10 dark:to-transparent"
                >
                  {rec.recurrence_hint ? (
                    <span className="self-start rounded-full bg-[#FFE6CC] px-2.5 py-1 text-[11px] font-extrabold text-[#C25E00] dark:bg-[#FF7A00]/20 dark:text-[#FFB066]">
                      {rec.recurrence_hint}
                    </span>
                  ) : null}
                  <h3 className="mt-3 line-clamp-2 text-base font-bold text-foreground">{rec.title}</h3>
                  {rec.description ? (
                    <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{rec.description}</p>
                  ) : null}
                  <PujaTitle name={rec.service_name} className="mt-2 block text-sm font-semibold text-foreground" />
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    {(() => {
                      const line = formatStartingFrom(rec);
                      return line ? <span className="text-sm font-extrabold text-[#FF7A00]">{line}</span> : <span />;
                    })()}
                    <Button
                      size="sm"
                      className="font-bold"
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
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard
          icon={<Flower2 size={18} />}
          title={t("customer.bookServices")}
          action={<ViewAllLink href="/services" label={t("common.viewAll")} />}
        >
          <div className="grid-cards">
            {pujaServicesOnly(pujas).slice(0, 6).map((puja) => (
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
                className="h-full min-w-0 cursor-pointer"
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
        </SectionCard>

        <SectionCard
          icon={<Calendar size={18} />}
          title={t("customer.myBookings")}
          action={<ViewAllLink href="/customer/bookings" label={t("common.viewAll")} />}
        >
          {isLoading && <Skeleton className="h-32 w-full rounded-2xl" />}
          {!isLoading && visibleBookings.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#EFE2CF] px-5 py-8 text-center text-sm font-medium text-muted-foreground dark:border-white/10">
              No bookings yet. Book a service above to get started.
            </p>
          )}
          {!isLoading && visibleBookings.length > 0 && (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-3 pb-3">{t("booking.service")}</th>
                      <th className="px-3 pb-3">{t("common.date")}</th>
                      <th className="px-3 pb-3">{t("booking.address")}</th>
                      <th className="px-3 pb-3">{t("common.total")}</th>
                      <th className="px-3 pb-3 text-right">{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBookings.map((booking) => (
                      <tr
                        key={booking.id}
                        className="cursor-pointer border-t border-[#EFE2CF] font-semibold hover:bg-[#FFFBF5] dark:border-white/10 dark:hover:bg-white/5"
                        onClick={() => setLocation("/customer/bookings")}
                      >
                        <td className="px-3 py-3.5">
                          <PujaTitle name={booking.service_name} className="block text-foreground" />
                          <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                            #{booking.booking_number} · {translatedTokenLabel(t(`booking.${booking.package_type}`), `booking.${booking.package_type}`, booking.package_type, "")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-foreground">
                          {formatDisplayDate(booking.booking_date)}
                          <span className="block text-xs text-muted-foreground">{booking.start_time || "—"}</span>
                        </td>
                        <td className="max-w-[22rem] px-3 py-3.5 text-foreground">
                          <span className="line-clamp-2" title={booking.location_label || undefined}>{booking.location_label || displayTokenLabel(booking.mode, "")}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-foreground">₹{((booking.total_paise || 0) / 100).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3.5 text-right">
                          <StatusPill status={customerStatus(booking)} label={customerStatusLabel(booking)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {visibleBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href="/customer/bookings"
                    className="flex items-start gap-3 rounded-2xl border border-[#EFE2CF] p-4 dark:border-white/10"
                  >
                    <div className="min-w-0 flex-1">
                      <PujaTitle name={booking.service_name} className="block font-bold text-foreground" />
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {formatDisplayDate(booking.booking_date)} · {booking.start_time || "—"} · ₹{((booking.total_paise || 0) / 100).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <StatusPill status={customerStatus(booking)} label={customerStatusLabel(booking)} />
                  </Link>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}

const STATUS_TONE: Record<string, string> = {
  confirmed: "bg-[#E4F4EA] text-[#1B7A4A] dark:bg-[#3DDC97]/15 dark:text-[#3DDC97]",
  completed: "bg-[#EEF1F6] text-[#2E4A6F] dark:bg-white/10 dark:text-white/80",
  in_progress: "bg-[#E6EEFB] text-[#1F4E99] dark:bg-[#7AA2D4]/15 dark:text-[#9DBDE6]",
  cancelled: "bg-[#FDE8E6] text-[#B83227] dark:bg-[#E74C3C]/15 dark:text-[#FF8A7D]",
};

function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${
        STATUS_TONE[status] || "bg-[#FFF1E2] text-[#C25E00] dark:bg-[#FF7A00]/15 dark:text-[#FFB066]"
      }`}
    >
      {label}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#EFE2CF] bg-white p-5 shadow-[0_22px_40px_-36px_rgba(120,60,10,0.55)] sm:p-6 dark:border-white/10 dark:bg-[#152238]">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E2] text-[#FF7A00] dark:bg-[#FF7A00]/15">
          {icon}
        </span>
        <h2 className="min-w-0 text-lg font-extrabold text-foreground sm:text-xl">{title}</h2>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-bold text-[#FF7A00] hover:underline">
      {label} <ArrowRight size={15} aria-hidden />
    </Link>
  );
}

function WalletRewardsSummary() {
  const { t } = useI18n();
  const [balance, setBalance] = useState<number | null>(null);
  const [rewardCount, setRewardCount] = useState<number | null>(null);

  useEffect(() => {
    api<{ wallet: { balance_paise: number } }>("/wallet")
      .then((r) => setBalance(r.wallet?.balance_paise || 0))
      .catch(() => setBalance(null));
    api<any[]>("/wallet/rewards")
      .then((r) => setRewardCount(Array.isArray(r) ? r.length : 0))
      .catch(() => setRewardCount(null));
  }, []);

  return (
    <SectionCard icon={<Wallet size={18} />} title={t("customer.walletPayments")}>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/customer/wallet" className="@container min-w-0 rounded-2xl bg-[#FFF6EA] p-4 dark:bg-[#FF7A00]/10">
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{t("wallet.balance")}</span>
          <span className="mt-1 block whitespace-nowrap tabular-nums tracking-tight text-[clamp(1rem,12cqi,1.5rem)] font-extrabold text-foreground">
            {balance == null ? "—" : `₹${(balance / 100).toLocaleString("en-IN")}`}
          </span>
        </Link>
        <Link href="/customer/rewards" className="rounded-2xl bg-[#F2EDFA] p-4 dark:bg-[#6B4BA8]/20">
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{t("nav.rewards")}</span>
          <span className="mt-1 block text-2xl font-extrabold text-foreground">{rewardCount == null ? "—" : rewardCount}</span>
        </Link>
      </div>
    </SectionCard>
  );
}

export default function CustomerDashboard() {
  return (
    <CustomerPortal>
      <CustomerDashboardContent />
    </CustomerPortal>
  );
}
