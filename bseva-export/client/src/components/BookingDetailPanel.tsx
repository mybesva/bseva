import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, rupees } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

export type BookingDetail = {
  id: string;
  booking_number?: string;
  status: string;
  service_name?: string;
  package_type?: string;
  booking_date?: string;
  start_time?: string;
  location_label?: string;
  mode?: string;
  base_price_paise?: number;
  platform_fee_paise?: number;
  gst_amount_paise?: number;
  total_paise?: number;
  pujari_payable_paise?: number;
  customer_name?: string;
  pujari_name?: string;
  rating_status?: string;
  customer_id?: string;
  pujari_id?: string;
  details_level?: string;
  samagri?: Array<{ name: string; required?: boolean; instructions?: string | null }>;
  special_instructions?: string | null;
  peak_fee_paise?: number;
  payment_status?: string;
  recurring_series_id?: string | null;
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
  onUpdated?: () => void;
  compact?: boolean;
};

export default function BookingDetailPanel({ bookingId, seed, role, onUpdated, compact }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const viewerRole = role || (user?.role === "pujari" ? "pujari" : user?.role === "admin" || user?.role === "super_admin" ? "admin" : "customer");
  const [booking, setBooking] = useState<BookingDetail | null>(
    seed ? ({ id: bookingId, status: "pending", ...seed } as BookingDetail) : null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [lastPing, setLastPing] = useState<{ latitude?: number; longitude?: number; recorded_at?: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const row = await api<BookingDetail>(`/bookings/${bookingId}`);
      setBooking(row);
      try {
        const ping = await api<any>(`/bookings/${bookingId}/location`);
        setLastPing(ping);
      } catch {
        setLastPing(null);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not load booking");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [bookingId]);

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      toast.success(okMsg);
      await load();
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!booking && loading) {
    return <p className="text-sm text-muted-foreground">Loading booking…</p>;
  }
  if (!booking) return null;

  const base = Number(booking.base_price_paise || 0);
  const platform = Number(booking.platform_fee_paise || 0);
  const gst = Number(booking.gst_amount_paise || 0);
  const total = Number(booking.total_paise || 0);
  const status = booking.status;
  const canAccept =
    viewerRole === "pujari" && ["pending", "pending_acceptance"].includes(status);
  const canStartOtp = viewerRole === "pujari" && status === "confirmed";
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
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={statusColor(status)}>{status.replace(/_/g, " ")}</Badge>
        {booking.mode && <Badge variant="outline">{booking.mode}</Badge>}
        {booking.package_type && <Badge variant="secondary" className="capitalize">{booking.package_type}</Badge>}
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {booking.service_name && (
            <div className="col-span-2">
              <div className="text-muted-foreground">Service</div>
              <div className="font-medium">{booking.service_name}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground">Date & time</div>
            <div className="font-medium">
              {booking.booking_date || "—"} {booking.start_time || ""}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{viewerRole === "pujari" ? "Customer" : "Pujari"}</div>
            <div className="font-medium">
              {viewerRole === "pujari" ? booking.customer_name || "—" : booking.pujari_name || "—"}
            </div>
          </div>
          {booking.location_label && (
            <div className="col-span-2">
              <div className="text-muted-foreground">Location</div>
              <div className="font-medium">{booking.location_label}</div>
            </div>
          )}
          {viewerRole === "pujari" && booking.details_level === "basic" && (
            <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Full customer address and contact unlock within the configured hours before the puja (default 24h).
            </div>
          )}
          {booking.special_instructions && (
            <div className="col-span-2">
              <div className="text-muted-foreground">Special instructions</div>
              <div className="font-medium whitespace-pre-wrap">{booking.special_instructions}</div>
            </div>
          )}
          {Array.isArray(booking.samagri) && booking.samagri.length > 0 && (
            <div className="col-span-2">
              <div className="text-muted-foreground mb-1">Recommended List</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {booking.samagri.map((it, i) => (
                  <li key={`${it.name}-${i}`}>
                    {it.name}
                    {it.required ? " (required)" : ""}
                    {it.instructions ? ` — ${it.instructions}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-sm">
        <div className="font-medium text-sidebar mb-1">Pricing</div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base</span>
          <span>{rupees(base)}</span>
        </div>
        {Number(booking.peak_fee_paise || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Surge / peak</span>
            <span>{rupees(Number(booking.peak_fee_paise))}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform fee</span>
          <span>{rupees(platform)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GST</span>
          <span>{rupees(gst)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-border pt-1.5">
          <span>Total</span>
          <span>{rupees(total)}</span>
        </div>
        {viewerRole === "pujari" && booking.pujari_payable_paise != null && (
          <div className="flex justify-between text-primary">
            <span>Your share</span>
            <span>{rupees(Number(booking.pujari_payable_paise))}</span>
          </div>
        )}
      </div>

      {viewerRole === "customer" && status === "confirmed" && (
        <p className="text-sm text-muted-foreground">
          When the pujari starts the puja, you will receive an OTP. Share it with your pujari to begin.
        </p>
      )}

      {canAccept && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-orange-50/50 p-3">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} className="mt-0.5" />
            <span>I accept the booking terms and will perform this puja as scheduled.</span>
          </label>
          <Button
            disabled={busy || !termsAccepted}
            onClick={() =>
              run(
                () =>
                  api(`/bookings/${bookingId}/accept`, {
                    method: "POST",
                    body: JSON.stringify({ terms_accepted: true, terms_version: "2026-01" }),
                  }).then(() => undefined),
                "Booking accepted"
              )
            }
          >
            {t("detail.accept")}
          </Button>
        </div>
      )}

      {canStartOtp && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <p className="text-sm text-muted-foreground">
            Request an OTP for the customer, then enter the code they share to start the puja.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const out = await api<{ ok: boolean; dev_code?: string }>(`/bookings/${bookingId}/start-otp/request`, {
                    method: "POST",
                  });
                  if (out.dev_code) {
                    setDevOtp(out.dev_code);
                    setOtpCode(out.dev_code);
                  }
                }, "OTP sent to customer")
              }
            >
              {t("detail.startOtp")}
            </Button>
          </div>
          {devOtp && (
            <p className="text-xs text-muted-foreground">Dev OTP: <strong>{devOtp}</strong></p>
          )}
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

      {viewerRole === "pujari" && (status === "confirmed" || status === "in_progress") && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Live location (pre-puja window)</p>
          {lastPing ? (
            <p className="text-xs text-muted-foreground">
              Last ping: {lastPing.latitude}, {lastPing.longitude} · {lastPing.recorded_at}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No location shared yet.</p>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !navigator.geolocation}
            onClick={() =>
              run(async () => {
                const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => resolve(pos.coords),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 15000 }
                  );
                });
                await api(`/bookings/${bookingId}/location`, {
                  method: "POST",
                  body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
                });
              }, "Location shared")
            }
          >
            Share my location
          </Button>
        </div>
      )}

      {viewerRole === "customer" && lastPing && (
        <p className="text-xs text-muted-foreground">
          Pujari location: {lastPing.latitude}, {lastPing.longitude} (updated {lastPing.recorded_at})
        </p>
      )}

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
        <Button
          disabled={busy}
          onClick={() =>
            run(
              () => api(`/bookings/${bookingId}/complete`, { method: "POST" }).then(() => undefined),
              "Puja completed"
            )
          }
        >
          {t("detail.complete")}
        </Button>
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
