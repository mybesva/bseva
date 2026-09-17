import { useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, downloadInvoicePdf, rupees } from "@/lib/api";
import { formatDisplayDate, formatDisplaySlot } from "@/lib/formatDate";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Calendar, Clock, MapPin, Printer, ArrowLeft, Loader2, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import PreparationChecklist from "@/components/PreparationChecklist";
import PujariLiveTrackCard from "@/components/PujariLiveTrackCard";
import { useI18n } from "@/i18n/I18nProvider";
import PrintableBSevaHeader from "@/components/PrintableBSevaHeader";
import { shareSafely } from "@/lib/browserActions";
import { formatPujaDuration } from "@bseva/locales";

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
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function BookingReceipt() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const search = useSearch();
  const qs = new URLSearchParams(search);
  const idOrNumber = params.id || qs.get("number") || "";
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLocation(
        getLoginUrl({
          role: "customer",
          returnPath: idOrNumber ? `/booking/${idOrNumber}` : "/my-bookings",
        })
      );
      return;
    }
    if (!idOrNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<any>(`/bookings/${encodeURIComponent(idOrNumber)}`)
      .then((row) => {
        setBooking(row);
      })
      .catch((e) => {
        toast.error(e.message || t("web.booking.loadFailed"));
        setBooking(null);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading, idOrNumber, setLocation]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!booking) {
    return (
      <Layout>
        <div className="container py-16 text-center space-y-4">
          <h1 className="text-h1">{t("web.booking.notFound")}</h1>
          <Button onClick={() => setLocation("/customer/bookings")}>{t("nav.bookings")}</Button>
        </div>
      </Layout>
    );
  }

  const showPujari = booking.pujari_details_visible === true && !!booking.pujari_name;
  const displayStatus = String(booking.customer_display_status || booking.status || "pending");
  const displayStatusLabel =
    displayStatus === "confirmed" ? t("web.booking.confirmed") : t(`status.${displayStatus}`);
  const slot = formatDisplaySlot(booking.booking_date, booking.start_time);
  const canCancel =
    user?.role === "customer" &&
    ["pending", "pending_acceptance", "confirmed"].includes(String(booking.status || ""));

  async function cancelBooking() {
    const reason = window.prompt(t("web.booking.cancelReason"));
    if (reason === null) return;
    try {
      await api(
        `/bookings/${booking.id}/cancel${
          reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : ""
        }`,
        { method: "POST" }
      );
      toast.success(t("web.booking.cancelled"));
      const refreshed = await api<any>(`/bookings/${booking.id}`);
      setBooking(refreshed);
    } catch (e: any) {
      toast.error(e.message || t("web.booking.cancelFailed"));
    }
  }

  async function shareReceipt() {
    const data = {
      title: t("web.booking.receipt"),
      text: `${booking.service_name} · ${booking.booking_number}`,
      url: window.location.href,
    };
    try {
      const result = await shareSafely(data);
      if (result === "copied") toast.success(t("web.booking.linkCopied"));
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error(t("web.booking.shareFailed"));
    }
  }

  function downloadReceipt() {
    const text = [
      "BSeva",
      t("app.tagline"),
      "",
      `${t("web.booking.receipt")}: ${booking.booking_number}`,
      `${t("booking.service")}: ${booking.service_name}`,
      `${t("web.booking.slot")}: ${slot}`,
      booking.duration_minutes ? `${t("web.booking.pujaDuration")}: ${formatPujaDuration(lang, booking.duration_minutes)}` : "",
      `${t("common.total")}: ${rupees(booking.total_paise)}`,
    ].filter(Boolean).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `BSeva-${booking.booking_number || "booking"}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="container max-w-3xl py-10 print:py-4">
        <PrintableBSevaHeader documentTitle={t("web.booking.receipt")} reference={booking.booking_number} />
        <div className="flex flex-wrap gap-2 mb-6 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setLocation("/customer/bookings")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {t("nav.bookings")}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> {t("web.booking.printReceipt")}
          </Button>
          <Button size="sm" variant="outline" onClick={downloadReceipt}>
            <Download className="w-4 h-4 mr-1" /> {t("common.download")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void shareReceipt()}>
            <Share2 className="w-4 h-4 mr-1" /> {t("common.share")}
          </Button>
          {canCancel && (
            <Button size="sm" variant="destructive" onClick={() => void cancelBooking()}>
              {t("booking.cancel")}
            </Button>
          )}
        </div>

        <Card className="border-2 border-primary/30 shadow-md print:shadow-none print:border">
          <CardHeader className="border-b bg-secondary/20 print:bg-transparent">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("web.booking.receipt")}</p>
                <CardTitle className="text-2xl mt-1">{booking.service_name || t("web.common.puja")}</CardTitle>
              </div>
              <Badge className={`${statusColor(displayStatus)} print:hidden`}>
                {displayStatusLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground">{t("booking.id")}</p>
                <p className="font-mono font-semibold text-base">{booking.booking_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("web.booking.internalRef")}</p>
                <p className="font-mono text-xs break-all">{booking.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("booking.service")}</p>
                <p className="font-medium">{booking.service_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("booking.package")}</p>
                <p className="font-medium capitalize">{booking.package_type ||"—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Calendar size={14} /> {t("web.booking.date")}
                </p>
                <p className="font-medium">{formatDisplayDate(booking.booking_date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Clock size={14} /> {t("web.booking.time")}
                </p>
                <p className="font-medium">{booking.start_time ||"—"}</p>
              </div>
              {booking.duration_minutes ? (
                <div>
                  <p className="text-muted-foreground">{t("web.booking.pujaDuration")}</p>
                  <p className="font-medium">{formatPujaDuration(lang, booking.duration_minutes)}</p>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">{t("web.booking.slot")}</p>
                <p className="font-semibold text-base">{slot}</p>
                {booking.end_time && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t("web.booking.endsApprox", { time: booking.end_time })}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">{t("booking.mode")}</p>
                <p className="font-medium">{booking.mode ? t(`booking.${booking.mode}`) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin size={14} /> {t("service.location")}
                </p>
                <p className="font-medium">{booking.location_label || booking.address ||"—"}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2 print:hidden">
              <h3 className="font-semibold">{t("booking.payment")}</h3>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("common.status")}</span>
                <span className="font-medium">{booking.payment_status ? t(`status.${booking.payment_status}`) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("web.booking.base")}</span>
                <span>{rupees(booking.base_price_paise)}</span>
              </div>
              {Number(booking.samagri_charge_paise || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("web.booking.samagriReimbursed")}</span>
                  <span>{rupees(booking.samagri_charge_paise)}</span>
                </div>
              )}
              {Number(booking.alankaram_charge_paise || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("web.booking.alankaramReimbursed")}</span>
                  <span>{rupees(booking.alankaram_charge_paise)}</span>
                </div>
              )}
              {Number(booking.food_charge_paise || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.food")}</span>
                  <span>{rupees(booking.food_charge_paise)}</span>
                </div>
              )}
              {Number(booking.peak_fee_paise || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.peakFee")}</span>
                  <span>{rupees(booking.peak_fee_paise)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("web.booking.platformFee")}</span>
                <span>{rupees(booking.platform_fee_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("booking.gst")} ({booking.gst_percent ?? 18}%)</span>
                <span>{rupees(booking.gst_amount_paise)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t("common.total")}</span>
                <span>{rupees(booking.total_paise)}</span>
              </div>
            </div>

            {booking.special_instructions ? (
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">{t("booking.special")}</h3>
                <p>{booking.special_instructions}</p>
              </div>
            ) : null}

            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold">{t("booking.pujari")}</h3>
              {showPujari ? (
                <div className="space-y-1">
                  <p className="font-medium">{booking.pujari_name}</p>
                  {booking.pujari_phone && <p className="text-muted-foreground">{booking.pujari_phone}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {booking.pujari_reveal_note ||
                    t("web.booking.pujariReveal")}
                </p>
              )}
            </div>

            {user?.role === "customer" &&
              booking.mode !== "virtual" &&
              Boolean(booking.pujari_id) &&
              ["confirmed", "in_progress"].includes(String(booking.status || "")) && (
                <div className="print:hidden">
                  <PujariLiveTrackCard
                    bookingId={String(booking.id)}
                    destinationLat={booking.latitude}
                    destinationLng={booking.longitude}
                  />
                </div>
              )}

            {booking.preparation ? (
              <PreparationChecklist preparation={booking.preparation} interactive={false} />
            ) : Array.isArray(booking.samagri) && booking.samagri.length > 0 ? (
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">{t("web.preparation.recommended")}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {booking.samagri.map((it: any, i: number) => (
                    <li key={i}>
                      {it.name}
                      {it.required ? ` (${t("common.required")})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="print:hidden flex flex-wrap gap-2 pt-2">
              <Button onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1" /> {t("common.print")}
              </Button>
              <Button variant="outline" onClick={() => setLocation("/customer/bookings")}>
                {t("web.booking.backToBookings")}
              </Button>
              {booking.invoice_id && booking.payment_status === "paid" ? (
                <Button
                  variant="outline"
                  onClick={() => void downloadInvoicePdf(String(booking.invoice_id)).catch((e) => toast.error(e.message))}
                >
                  <Download className="w-4 h-4 mr-1" /> {t("invoice.download")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
