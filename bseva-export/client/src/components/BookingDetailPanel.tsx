import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, downloadInvoicePdf, rupees } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import PreparationChecklist from "@/components/PreparationChecklist";
import PujariLiveTrackCard from "@/components/PujariLiveTrackCard";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  downloadSamagriListForBooking,
  printSamagriListForBooking,
  shareSamagriListForBooking,
  samagriExportLabels,
} from "@/lib/downloadSamagriList";
import { formatPujaDuration } from "@bseva/locales";
import { PujaTitle } from "@/components/PujaTitle";
import { Download, Printer, Share2 } from "lucide-react";
import { mapsDirectionsUrl, mapsSearchUrl } from "@/lib/googleMaps";
import { pujariTeamAcceptNotice, pujariTeamPaymentNotice, pujarisIncludedShort } from "@/lib/pujariTeam";
import PrintableBSevaHeader from "@/components/PrintableBSevaHeader";
import { shareSafely } from "@/lib/browserActions";
import { downloadBSevaDocument, fieldsToDocumentBody } from "@/lib/bsevaDocument";

export type BookingDetail = {
  id: string;
  booking_number?: string;
  status: string;
  service_name?: string;
  package_type?: string;
  booking_date?: string;
  start_time?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string;
  mode?: string;
  meeting_url?: string | null;
  public_invite_url?: string | null;
  meeting_link_visible?: boolean;
  base_price_paise?: number;
  platform_fee_paise?: number;
  gst_amount_paise?: number;
  total_paise?: number;
  pujari_payable_paise?: number;
  samagri_charge_paise?: number;
  alankaram_charge_paise?: number;
  samagri_requested?: boolean;
  alankaram_requested?: boolean;
  food_charge_paise?: number;
  customer_name?: string;
  pujari_name?: string;
  rating_status?: string;
  customer_id?: string;
  pujari_id?: string;
  details_level?: string;
  samagri?: Array<{ name: string; required?: boolean; instructions?: string | null }>;
  preparation?: any;
  special_instructions?: string | null;
  peak_fee_paise?: number;
  payment_status?: string;
  recurring_series_id?: string | null;
  rejection_reason?: string | null;
  needs_reassignment?: boolean;
  pujaris_required?: number;
  pujaris_included_label?: string;
  pujari_team_customer_note?: string;
  pujari_team_notice?: string | null;
  pujari_payment_notice?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  customer_display_status?: string;
  awaiting_pujari_assignment?: boolean;
  admin_assignment_required?: boolean;
  eligible_pujari_found?: boolean;
  duration_minutes?: number | null;
  service_id?: string;
  service_slug?: string;
  virtual_available?: boolean;
};

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
    case "accepted":
      return "bg-green-100 text-green-800";
    case "pending":
    case "pending_acceptance":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

type Props = {
  bookingId: string;
  /** Optional list-row seed so UI paints immediately before detail fetch. */
  seed?: Partial<BookingDetail>;
  role?: "customer" | "pujari" | "admin";
  onUpdated?: (info?: { decision?: "accepted" | "rejected" | "cancelled" }) => void;
  compact?: boolean;
  /** When opened from dashboard Reject, jump straight to rejection dialog. */
  initialIntent?: "accept" | "reject" | null;
};

export default function BookingDetailPanel({ bookingId, seed, role, onUpdated, compact, initialIntent }: Props) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const viewerRole = role || (user?.role === "pujari" ? "pujari" : user?.role === "admin" || user?.role === "super_admin" ? "admin" : "customer");
  const [booking, setBooking] = useState<BookingDetail | null>(
    seed ? ({ id: bookingId, status: "pending", ...seed } as BookingDetail) : null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [customerOtp, setCustomerOtp] = useState<{
    available?: boolean;
    code?: string | null;
    message?: string | null;
    window_minutes?: number;
  } | null>(null);
  const [completeOtp, setCompleteOtp] = useState<{
    available?: boolean;
    code?: string | null;
    message?: string | null;
    customer_can_verify?: boolean;
  } | null>(null);
  const [completeCode, setCompleteCode] = useState("");
  const [resendWait, setResendWait] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");
  const [pujariOrigin, setPujariOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPreview, setCancelPreview] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const samagriLabels = samagriExportLabels(t);

  async function load() {
    setLoading(true);
    try {
      const row = await api<BookingDetail>(`/bookings/${bookingId}`);
      setBooking(row);
      try {
        const otp = await api<any>(`/bookings/${bookingId}/start-otp`);
        setCustomerOtp(otp);
      } catch {
        setCustomerOtp(null);
      }
      try {
        const cotp = await api<any>(`/bookings/${bookingId}/complete-otp`);
        setCompleteOtp(cotp);
      } catch {
        setCompleteOtp(null);
      }
    } catch (e: any) {
      toast.error(e.message || t("web.booking.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    const t = window.setInterval(() => {
      api<any>(`/bookings/${bookingId}/start-otp`).then(setCustomerOtp).catch(() => undefined);
      api<any>(`/bookings/${bookingId}/complete-otp`).then(setCompleteOtp).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(t);
  }, [bookingId]);

  useEffect(() => {
    if (resendWait <= 0) return;
    const t = window.setTimeout(() => setResendWait((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendWait]);

  useEffect(() => {
    if (viewerRole !== "pujari") return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPujariOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, [viewerRole, bookingId]);

  useEffect(() => {
    if (initialIntent === "reject" && !loading) {
      setRejectReason("");
      setRejectOpen(true);
    }
  }, [initialIntent, bookingId, loading]);

  async function run(
    action: () => Promise<void>,
    okMsg: string,
    decision?: "accepted" | "rejected" | "cancelled"
  ) {
    setBusy(true);
    try {
      await action();
      toast.success(okMsg);
      if (decision === "accepted" || decision === "rejected" || decision === "cancelled") {
        onUpdated?.({ decision });
      } else {
        await load();
        onUpdated?.();
      }
    } catch (e: any) {
      toast.error(e.message || t("web.booking.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!booking && loading) {
    return <p className="text-sm text-muted-foreground">{t("mobile.loading")}</p>;
  }
  if (!booking) return null;

  const base = Number(booking.base_price_paise || 0);
  const platform = Number(booking.platform_fee_paise || 0);
  const gst = Number(booking.gst_amount_paise || 0);
  const total = Number(booking.total_paise || 0);
  const status = booking.status;
  const displayStatus =
    viewerRole === "customer" ? booking.customer_display_status || status : status;
  const displayStatusLabel =
    viewerRole === "customer" && displayStatus === "confirmed"
      ? t("web.booking.confirmed")
      : t(`status.${displayStatus}`);
  const canAccept =
    viewerRole === "pujari" && ["pending", "pending_acceptance"].includes(status);
  const canCancelBooking =
    ["pending", "pending_acceptance", "confirmed"].includes(status) &&
    (viewerRole === "customer" || (viewerRole === "pujari" && status === "confirmed"));
  const canStartOtp = viewerRole === "pujari" && status === "confirmed";
  const samagriSelected =
    Boolean(booking.samagri_requested) || Number(booking.samagri_charge_paise || 0) > 0;
  const teamSize = Math.max(1, Number(booking.pujaris_required || 1));
  const teamLabel = pujarisIncludedShort(teamSize, t);
  const teamCustomerNote =
    teamSize > 1 ? t("web.booking.teamCustomerNote", { count: teamSize }) : null;
  const teamPujariNotice = pujariTeamAcceptNotice(teamSize, t);
  const teamPaymentNotice = pujariTeamPaymentNotice(teamSize, t);

  async function downloadSamagri() {
    try {
      setBusy(true);
      await downloadSamagriListForBooking(bookingId, samagriLabels);
      toast.success(t("web.booking.samagriDownloaded"));
    } catch (e: any) {
      toast.error(e?.message || t("web.booking.samagriDownloadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function openCancelDialog() {
    setCancelReason("");
    setCancelLoading(true);
    setCancelOpen(true);
    try {
      setCancelPreview(await api(`/bookings/${bookingId}/cancel-preview`));
    } catch (e: any) {
      setCancelPreview(null);
      toast.error(e.message || t("web.booking.cancelPreviewFailed"));
      setCancelOpen(false);
    } finally {
      setCancelLoading(false);
    }
  }
  const canComplete = viewerRole === "pujari" && status === "in_progress";
  const ratingDoneForRole =
    booking.rating_status === "completed" ||
    booking.rating_status === "skipped" ||
    (viewerRole === "customer" && booking.rating_status === "customer_done") ||
    (viewerRole === "pujari" && booking.rating_status === "pujari_done");
  const showRate =
    status === "completed" &&
    !ratingDoneForRole &&
    (viewerRole === "customer" || viewerRole === "pujari");

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {viewerRole === "customer" ? (
        <PrintableBSevaHeader
          documentTitle={t("web.booking.detailsReceipt")}
          reference={booking.booking_number}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`${statusColor(displayStatus)} print:hidden`}>{displayStatusLabel}</Badge>
        {booking.mode && <Badge variant="outline">{t(`booking.${booking.mode === "physical" ? "physical" : booking.mode}`)}</Badge>}
        {booking.package_type && <Badge variant="secondary">{t(`booking.${booking.package_type}`)}</Badge>}
        {viewerRole === "pujari" && samagriSelected && (
          <Badge className="bg-orange-100 text-orange-900 border-orange-200">{t("web.pujariBookings.samagriSelected")}</Badge>
        )}
        {viewerRole === "admin" && booking.needs_reassignment && (
          <Badge variant="destructive">{t("web.booking.needsReassignment")}</Badge>
        )}
        <Badge variant="outline" className="font-normal">
          {teamLabel}
        </Badge>
      </div>

      {teamCustomerNote && viewerRole === "customer" ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {teamCustomerNote}
        </div>
      ) : null}

      {viewerRole === "pujari" && teamPujariNotice ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-1">
          <p className="font-semibold">{teamPujariNotice}</p>
          {teamPaymentNotice ? <p className="text-xs leading-relaxed">{teamPaymentNotice}</p> : null}
        </div>
      ) : null}

      {booking.mode === "virtual" && (booking.meeting_url || booking.public_invite_url) && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("web.booking.virtualMeet")}</p>
          {booking.meeting_url ? (
            <Button asChild size="sm" className="w-full sm:w-auto">
              <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer">
                {t("web.meeting.join")}
              </a>
            </Button>
          ) : null}
          {booking.public_invite_url ? (
            <p className="text-xs text-muted-foreground break-all">
              {t("web.booking.publicInvite")}: {booking.public_invite_url}
            </p>
          ) : null}
        </div>
      )}

      {viewerRole === "customer" &&
        booking.mode !== "virtual" &&
        Boolean(booking.pujari_id) &&
        ["confirmed", "in_progress"].includes(status) && (
          <PujariLiveTrackCard
            bookingId={bookingId}
            destinationLat={booking.latitude}
            destinationLng={booking.longitude}
          />
        )}

      {status === "rejected" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {booking.rejection_reason
            ? t("web.booking.rejectedReason", { reason: booking.rejection_reason })
            : t("web.booking.rejectedByPujari")}{" "}
          {viewerRole === "customer"
            ? t("web.booking.findingPujari")
            : t("web.booking.adminReassign")}
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {booking.service_name && (
            <div className="col-span-2">
              <div className="text-muted-foreground">{t("booking.service")}</div>
              <div className="font-medium">
                <PujaTitle name={booking.service_name} />
              </div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground">{t("web.muhurta.dateTime")}</div>
            <div className="font-medium">
              {formatDisplayDate(booking.booking_date)} {booking.start_time || ""}
            </div>
          </div>
          {booking.duration_minutes ? (
            <div>
              <div className="text-muted-foreground">{t("services.duration")}</div>
              <div className="font-medium">{formatPujaDuration(lang, booking.duration_minutes)}</div>
            </div>
          ) : null}
          <div>
            <div className="text-muted-foreground">{viewerRole === "pujari" ? t("auth.customer") : t("auth.pujari")}</div>
            <div className="font-medium">
              {viewerRole === "pujari" ? booking.customer_name || "—" : booking.pujari_name || "—"}
            </div>
          </div>
          {booking.location_label && (
            <div className="col-span-2">
              <div className="text-muted-foreground">{t("detail.serviceLocation")}</div>
              <div className="font-medium">{booking.location_label}</div>
              {viewerRole === "pujari" &&
                booking.latitude != null &&
                booking.longitude != null &&
                (status === "confirmed" || status === "in_progress") && (
                  <div className="flex flex-wrap gap-3 mt-1">
                    <a
                      className="text-sm text-primary underline"
                      href={mapsSearchUrl(Number(booking.latitude), Number(booking.longitude))}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("track.openMaps")}
                    </a>
                    <a
                      className="text-sm text-primary underline"
                      href={mapsDirectionsUrl({
                        originLat: pujariOrigin?.lat,
                        originLng: pujariOrigin?.lng,
                        destLat: Number(booking.latitude),
                        destLng: Number(booking.longitude),
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("detail.directionsToPuja")}
                    </a>
                  </div>
                )}
            </div>
          )}
          {viewerRole === "pujari" && booking.details_level === "basic" && (
            <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t("web.booking.contactUnlock")}
            </div>
          )}
          {booking.special_instructions && (
            <div className="col-span-2">
              <div className="text-muted-foreground">{t("booking.special")}</div>
              <div className="font-medium whitespace-pre-wrap">{booking.special_instructions}</div>
            </div>
          )}
          {booking.preparation ? (
            <div className="col-span-2">
              {viewerRole === "pujari" &&
              !(
                Number(booking.samagri_charge_paise || 0) > 0 ||
                Number(booking.alankaram_charge_paise || 0) > 0 ||
                Boolean((booking as any).samagri_requested) ||
                Boolean((booking as any).alankaram_requested)
              ) ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {t("web.booking.customerArranges")}
                </div>
              ) : (
                <PreparationChecklist
                  preparation={booking.preparation}
                  compact
                  interactive={false}
                  title={
                    viewerRole === "pujari"
                      ? t("web.booking.itemsToArrange")
                      : t("web.preparation.title")
                  }
                />
              )}
            </div>
          ) : Array.isArray(booking.samagri) &&
            booking.samagri.length > 0 &&
            (viewerRole !== "pujari" ||
              Number(booking.samagri_charge_paise || 0) > 0 ||
              Boolean((booking as any).samagri_requested)) ? (
            <div className="col-span-2">
              <div className="text-muted-foreground mb-1">{t("web.preparation.recommended")}</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {booking.samagri.map((it, i) => (
                  <li key={`${it.name}-${i}`}>
                    {it.name}
                    {it.required ? ` (${t("common.required")})` : ""}
                    {it.instructions ? ` — ${it.instructions}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-sm">
        <div className="font-medium text-foreground mb-1">
          {viewerRole === "pujari" ? t("web.earnings.title") : t("web.booking.pricing")}
        </div>
        {viewerRole === "pujari" ? (
          <>
            {Number(booking.samagri_charge_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("web.booking.samagriReimbursed")}</span>
                <span>{rupees(Number(booking.samagri_charge_paise))}</span>
              </div>
            )}
            {Number(booking.alankaram_charge_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("web.booking.alankaramReimbursed")}</span>
                <span>{rupees(Number(booking.alankaram_charge_paise))}</span>
              </div>
            )}
            {Number(booking.food_charge_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.food")}</span>
                <span>{rupees(Number(booking.food_charge_paise))}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-primary border-t border-border pt-1.5">
              <span>{t("web.earnings.title")}</span>
              <span>
                {rupees(
                  Number(
                    booking.pujari_payable_paise != null
                      ? booking.pujari_payable_paise
                      : Math.max(0, base - platform)
                  )
                )}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("web.booking.base")}</span>
              <span>{rupees(base)}</span>
            </div>
            {Number(booking.samagri_charge_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.samagri")}</span>
                <span>{rupees(Number(booking.samagri_charge_paise))}</span>
              </div>
            )}
            {Number(booking.alankaram_charge_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.alankaram")}</span>
                <span>{rupees(Number(booking.alankaram_charge_paise))}</span>
              </div>
            )}
            {Number(booking.food_charge_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.food")}</span>
                <span>{rupees(Number(booking.food_charge_paise))}</span>
              </div>
            )}
            {Number(booking.peak_fee_paise || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.peakFee")}</span>
                <span>{rupees(Number(booking.peak_fee_paise))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("web.booking.platformFee")}</span>
              <span>{rupees(platform)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("booking.gst")}</span>
              <span>{rupees(gst)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1.5">
              <span>{t("common.total")}</span>
              <span>{rupees(total)}</span>
            </div>
          </>
        )}
      </div>

      {viewerRole === "customer" && status === "confirmed" && (
        <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <p className="text-sm font-medium text-foreground">{t("otp.startTitle")}</p>
          {customerOtp?.available && customerOtp.code ? (
            <>
              <p className="text-2xl font-bold tracking-widest text-primary">{customerOtp.code}</p>
              <p className="text-xs text-muted-foreground">{t("otp.startShare")}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {customerOtp?.message ||
                `OTP appears here from ${customerOtp?.window_minutes ?? 15} minutes before the scheduled start.`}
            </p>
          )}
        </div>
      )}

      {viewerRole === "customer" && status === "in_progress" && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{t("otp.verifyComplete")}</p>
          <p className="text-xs text-muted-foreground">{t("otp.completeEnter")}</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label>OTP</Label>
              <Input value={completeCode} onChange={(e) => setCompleteCode(e.target.value)} placeholder="Enter OTP" maxLength={8} />
            </div>
            <Button
              disabled={busy || completeCode.trim().length < 4}
              onClick={() =>
                run(
                  () =>
                    api(`/bookings/${bookingId}/complete-otp/verify`, {
                      method: "POST",
                      body: JSON.stringify({ code: completeCode.trim() }),
                    }).then(() => undefined),
                  t("otp.completeAction"),
                )
              }
            >
              {t("otp.completeAction")}
            </Button>
          </div>
        </div>
      )}

      {viewerRole === "customer" && status === "confirmed" && (
        <p className="text-sm text-muted-foreground">
          When the pujari starts the puja, share the OTP shown above. Tracking of the pujari opens{" "}
          {customerOtp?.window_minutes ?? 15} minutes before start.
        </p>
      )}

      {canAccept && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-orange-50/50 p-3">
          {viewerRole === "pujari" && samagriSelected && (
            <div className="space-y-3 rounded-md border border-orange-200 bg-white/80 p-3">
              <p className="text-sm font-semibold text-foreground">
                Samagri selected — review the list before accepting
              </p>
              {booking.preparation ? (
                <PreparationChecklist
                  preparation={booking.preparation}
                  compact
                  interactive={false}
                  title={t("mobile.samagriList")}
                />
              ) : Array.isArray(booking.samagri) && booking.samagri.length > 0 ? (
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  {booking.samagri.map((it, i) => (
                    <li key={`${it.name}-${i}`}>{it.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("web.preparation.pending")}
                </p>
              )}
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void downloadSamagri()}>
                <Download className="h-4 w-4 mr-2" />
                {t("web.booking.downloadSamagri")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void printSamagriListForBooking(bookingId, samagriLabels)}>
                <Printer className="h-4 w-4 mr-2" />
                {t("web.preparation.print")}
              </Button>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} className="mt-0.5" />
            <span>I accept the booking terms and will perform this puja as scheduled.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !termsAccepted}
              onClick={() =>
                void run(
                  () =>
                    api(`/bookings/${bookingId}/accept`, {
                      method: "POST",
                      body: JSON.stringify({ terms_accepted: true, terms_version: "2026-01" }),
                    }).then(() => undefined),
                  "Accepted — booking confirmed",
                  "accepted"
                )
              }
            >
              {t("detail.accept")}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => { setRejectReason(""); setRejectOpen(true); }}>
              Reject
            </Button>
          </div>
        </div>
      )}

      {viewerRole === "pujari" && samagriSelected && !canAccept && (
        <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
          <p className="text-sm font-semibold text-foreground">Samagri list</p>
          {booking.preparation ? (
            <PreparationChecklist
              preparation={booking.preparation}
              compact
              interactive={false}
              title={t("mobile.samagriList")}
            />
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void downloadSamagri()}>
            <Download className="h-4 w-4 mr-2" />
            {t("web.booking.downloadSamagri")}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void printSamagriListForBooking(bookingId, samagriLabels)}>
            <Printer className="h-4 w-4 mr-2" />
            {t("web.preparation.print")}
          </Button>
        </div>
      )}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Reject this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Rejecting will notify admin to reassign this puja to another pujari. This cannot be undone from your side.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Not available on this date / outside service area"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                void run(
                  () =>
                    api(`/bookings/${bookingId}/reject`, {
                      method: "POST",
                      body: JSON.stringify({ reason: rejectReason.trim() || null }),
                    }).then(() => undefined),
                  "Rejected — admin will reassign this booking",
                  "rejected"
                )
              }
            >
              Confirm reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canCancelBooking && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {viewerRole === "pujari"
              ? "You can cancel an accepted booking. Under 24 hours this is charged as a no-show (100% of that puja’s cost)."
              : "You can cancel this booking. Under 24 hours the charge is 100% (no refund)."}
          </p>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => void openCancelDialog()}>
            Cancel booking
          </Button>
        </div>
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelLoading
                ? "Loading charges…"
                : cancelPreview && !cancelPreview.allowed
                  ? cancelPreview.message || "Cancellation not allowed at this time."
                  : "Review the time-based charges below before confirming."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!cancelLoading && cancelPreview && !cancelPreview.allowed && (
            <p className="text-sm text-destructive font-medium">
              {cancelPreview.message ||
                "Cancellation is not allowed less than 24 hours before the booking."}
            </p>
          )}
          {!cancelLoading && cancelPreview?.allowed && (
            <div className="text-sm space-y-2 rounded-md border border-border bg-muted/40 p-3">
              <p>
                Time until puja: <strong>{cancelPreview.hours_until ?? "—"} hours</strong> (policy:{" "}
                {cancelPreview.policy})
              </p>
              {viewerRole === "pujari" ? (
                <p>
                  Cancellation charge for you:{" "}
                  <strong>
                    {rupees(Number(cancelPreview.fee_paise || 0))} ({cancelPreview.fee_percent}%)
                  </strong>
                </p>
              ) : (
                <>
                  <p>
                    Cancellation fee:{" "}
                    <strong>
                      {rupees(Number(cancelPreview.fee_paise || 0))} ({cancelPreview.fee_percent}%)
                    </strong>
                  </p>
                  <p>
                    Refund to your wallet: <strong>{rupees(Number(cancelPreview.refund_paise || 0))}</strong>
                  </p>
                </>
              )}
            </div>
          )}
          {cancelPreview?.allowed && (
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason for cancellation *</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please explain why you are cancelling (min 5 characters)"
                rows={2}
                minLength={5}
                required
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={
                !cancelPreview?.allowed ||
                cancelLoading ||
                busy ||
                cancelReason.trim().length < 5
              }
              onClick={(e) => {
                e.preventDefault();
                if (cancelReason.trim().length < 5) {
                  toast.error("Cancellation reason must be at least 5 characters");
                  return;
                }
                void run(
                  async () => {
                    await api(
                      `/bookings/${bookingId}/cancel${
                        cancelReason.trim() ? `?reason=${encodeURIComponent(cancelReason.trim())}` : ""
                      }`,
                      { method: "POST" }
                    );
                    setCancelOpen(false);
                    setCancelReason("");
                    setCancelPreview(null);
                  },
                  viewerRole === "pujari"
                    ? "Booking cancelled. Charges may apply per policy."
                    : "Booking cancelled",
                  "cancelled"
                );
              }}
            >
              Confirm cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canStartOtp && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <p className="text-sm text-muted-foreground">
            Ask the customer for their Start Puja OTP, then enter it here to begin.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy || resendWait > 0}
              onClick={() =>
                run(async () => {
                  try {
                    await api(`/bookings/${bookingId}/start-otp/request`, { method: "POST" });
                    setResendWait(60);
                  } catch (e: any) {
                    const msg = String(e?.message || "");
                    const m = msg.match(/(\d+)\s*s/);
                    if (m) setResendWait(Number(m[1]));
                    throw e;
                  }
                }, t("otp.resent"))
              }
            >
              {resendWait > 0 ? t("otp.cooldown", { seconds: resendWait }) : t("otp.resend")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label>OTP code</Label>
              <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter OTP" maxLength={8} />
            </div>
            <Button
              disabled={busy || otpCode.trim().length < 4}
              onClick={() =>
                run(
                  () =>
                    api(`/bookings/${bookingId}/start-otp/verify`, {
                      method: "POST",
                      body: JSON.stringify({ code: otpCode.trim() }),
                    }).then(() => undefined),
                  "Puja started"
                )
              }
            >
              Start puja
            </Button>
          </div>
        </div>
      )}

      {viewerRole === "customer" && booking.invoice_id && booking.payment_status === "paid" && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void downloadInvoicePdf(String(booking.invoice_id)).catch((e) => toast.error(e.message || t("invoice.openFailed")))
          }
        >
          <Download className="h-4 w-4 mr-2" />
          {t("invoice.download")}
          {booking.invoice_number ? ` · ${booking.invoice_number}` : ""}
        </Button>
      )}

      {viewerRole === "customer" ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              downloadBSevaDocument(`BSeva-${booking.booking_number || booking.id}.html`, {
                documentTitle: t("web.booking.detailsReceipt"),
                reference: booking.booking_number || String(booking.id),
                bodyHtml: fieldsToDocumentBody([
                  [t("booking.id"), String(booking.booking_number || booking.id)],
                  [t("booking.service"), booking.service_name || "—"],
                  [t("common.total"), rupees(total)],
                ]),
              });
            }}
          >
            <Download className="h-4 w-4 mr-2" /> {t("common.download")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> {t("common.print")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const value = `${booking.service_name || t("web.common.puja")} · ${booking.booking_number || booking.id}`;
              void shareSafely({ title: booking.service_name, text: value, url: window.location.href }).then(
                (result) => result === "copied" && toast.success(t("web.booking.linkCopied")),
                (error) => {
                  if ((error as DOMException)?.name !== "AbortError") toast.error(t("web.booking.shareFailed"));
                },
              );
            }}
          >
            <Share2 className="h-4 w-4 mr-2" /> {t("common.share")}
          </Button>
        </div>
      ) : null}

      {viewerRole === "customer" && booking.payment_status === "pending" && status !== "cancelled" && (
        <Button
          disabled={busy}
          onClick={() =>
            run(
              () => api(`/bookings/${bookingId}/pay`, { method: "POST" }).then(() => undefined),
              "Payment successful"
            )
          }
        >
          {t("booking.payPending")}
        </Button>
      )}

      {viewerRole === "customer" && booking.recurring_series_id && status !== "cancelled" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              () =>
                api(`/recurring/${booking.recurring_series_id}/cancel`, {
                  method: "POST",
                  body: JSON.stringify({}),
                }).then(() => undefined),
              "Unpaid series bookings cancelled"
            )
          }
        >
          {t("booking.cancelSeries")}
        </Button>
      )}

      {canComplete && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="font-medium text-sm">{t("otp.completeTitle")}</p>
          {completeOtp?.code ? (
            <>
              <p className="text-2xl font-bold tracking-widest text-primary">{completeOtp.code}</p>
              <p className="text-xs text-muted-foreground">{t("otp.completeShare")}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{completeOtp?.message || t("detail.waitingCompletion")}</p>
          )}
          <Button
            variant="secondary"
            disabled={busy || resendWait > 0}
            onClick={() =>
              run(async () => {
                try {
                  await api(`/bookings/${bookingId}/complete-otp/request`, { method: "POST" });
                  setResendWait(60);
                } catch (e: any) {
                  const msg = String(e?.message || "");
                  const m = msg.match(/(\d+)\s*s/);
                  if (m) setResendWait(Number(m[1]));
                  throw e;
                }
              }, "OTP updated")
            }
          >
            {resendWait > 0 ? t("otp.cooldown", { seconds: resendWait }) : t("otp.resend")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("detail.waitingCompletion")}</p>
        </div>
      )}

      {viewerRole === "admin" && status === "confirmed" && (
        <div className="space-y-2 rounded-lg border p-3">
          <Label>Admin start override reason</Label>
          <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          <Button
            disabled={busy || overrideReason.trim().length < 5}
            onClick={() =>
              run(
                () =>
                  api(`/bookings/${bookingId}/admin/start`, {
                    method: "POST",
                    body: JSON.stringify({ reason: overrideReason.trim() }),
                  }).then(() => undefined),
                "Puja started (admin override)",
              )
            }
          >
            Admin start puja
          </Button>
        </div>
      )}

      {viewerRole === "admin" && status === "in_progress" && (
        <div className="space-y-2 rounded-lg border p-3">
          <Label>Admin complete override reason</Label>
          <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          <Button
            disabled={busy || overrideReason.trim().length < 5}
            onClick={() =>
              run(
                () =>
                  api(`/bookings/${bookingId}/admin/complete`, {
                    method: "POST",
                    body: JSON.stringify({ reason: overrideReason.trim() }),
                  }).then(() => undefined),
                "Puja completed (admin override)",
              )
            }
          >
            Admin complete puja
          </Button>
        </div>
      )}

      {showRate && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="font-medium text-sm">Rate this experience</div>
          <div className="space-y-1">
            <Label>Stars</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={stars}
              onChange={(e) => setStars(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Comment (optional)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api(`/bookings/${bookingId}/ratings`, {
                      method: "POST",
                      body: JSON.stringify({ stars, comment: comment || null, skip: false }),
                    }).then(() => undefined),
                  "Thanks for your rating"
                )
              }
            >
              Submit rating
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api(`/bookings/${bookingId}/ratings`, {
                      method: "POST",
                      body: JSON.stringify({ skip: true }),
                    }).then(() => undefined),
                  "Rating skipped"
                )
              }
            >
              Skip
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
