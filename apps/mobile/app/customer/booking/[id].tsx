import { isPujariRole, rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TrackingMap } from "@/components/TrackingMap";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { isPujariTrackingStarted } from "@/services/pujariTracking";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplaySlot } from "@/utils/formatDate";
import { openMapsDirections, openMapsSearch } from "@/utils/maps";
import { useI18n } from "@/providers/I18nProvider";

type LocationPing = {
  available?: boolean;
  tracking_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at?: string | null;
  message?: string | null;
  poll_interval_seconds?: number;
  distance_m?: number | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  arrived?: boolean;
  stale?: boolean;
};

function lastUpdatedLabel(iso?: string | null) {
  if (!iso) return "just now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "just now";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CustomerStartOtp({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const otpQ = useQuery({
    queryKey: ["start-otp", bookingId],
    queryFn: () => apiClient.getStartOtp(bookingId),
    refetchInterval: 30_000,
  });
  if (!otpQ.data) return null;
  return (
    <Card>
      <AppText variant="h3">{t("otp.startTitle")}</AppText>
      {otpQ.data.code ? (
        <>
          <AppText variant="h1" color={colors.primary} style={{ letterSpacing: 4 }}>
            {otpQ.data.code}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {t("otp.startShare")}
          </AppText>
        </>
      ) : (
        <AppText variant="small" color={colors.mutedForeground}>
          {otpQ.data.message || t("track.notAvailable")}
        </AppText>
      )}
    </Card>
  );
}

function PujariCompleteOtp({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const otpQ = useQuery({
    queryKey: ["complete-otp", bookingId],
    queryFn: () => apiClient.getCompleteOtp(bookingId),
    refetchInterval: 30_000,
  });
  if (!otpQ.data) return null;
  return (
    <Card>
      <AppText variant="h3">{t("otp.completeTitle")}</AppText>
      {otpQ.data.code ? (
        <>
          <AppText variant="h1" color={colors.primary} style={{ letterSpacing: 4 }}>
            {otpQ.data.code}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {t("otp.completeShare")}
          </AppText>
        </>
      ) : (
        <AppText variant="small" color={colors.mutedForeground}>
          {otpQ.data.message || t("mobile.waitingCompletion")}
        </AppText>
      )}
    </Card>
  );
}

function LiveTrackCard({ bookingId, role }: { bookingId: string; role: "customer" | "pujari" }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const loc = useQuery({
    queryKey: ["booking-loc", bookingId],
    queryFn: () => apiClient.getBookingLocation(bookingId) as Promise<LocationPing>,
    refetchInterval: (q) => {
      const secs = (q.state.data as LocationPing | undefined)?.poll_interval_seconds || 60;
      return Math.max(15_000, secs * 1000);
    },
  });
  const ping = loc.data;
  const lat = ping?.latitude != null ? Number(ping.latitude) : null;
  const lng = ping?.longitude != null ? Number(ping.longitude) : null;
  const destLat = ping?.destination_latitude != null ? Number(ping.destination_latitude) : null;
  const destLng = ping?.destination_longitude != null ? Number(ping.destination_longitude) : null;
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const trackingOn = ping?.tracking_active !== false && ping?.available !== false;

  if (!ping && loc.isLoading) return null;
  if (!trackingOn && !hasCoords) {
    return (
      <Card>
        <AppText variant="h3">{t("track.title")}</AppText>
        <AppText variant="small" color={colors.mutedForeground}>
          {ping?.message || t("track.notAvailable")}
        </AppText>
      </Card>
    );
  }

  const km = ping?.distance_m != null ? `${(Number(ping.distance_m) / 1000).toFixed(1)} km` : null;

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{t("track.title")}</AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {hasCoords
              ? `${t("track.lastUpdated")}: ${lastUpdatedLabel(ping?.recorded_at)}`
              : t("track.waitingPujari")}
          </AppText>
        </View>
        <PrimaryButton title={t("track.refresh")} variant="outline" onPress={() => void loc.refetch()} />
      </View>
      {km ? (
        <AppText variant="small">
          {t("track.distance")}: {km}
        </AppText>
      ) : null}
      {ping?.stale || ping?.message ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {ping.message || t("track.stale")}
        </AppText>
      ) : null}
      {hasCoords ? (
        <>
          <TrackingMap latitude={lat!} longitude={lng!} destLat={destLat} destLng={destLng} />
          {role === "customer" ? (
            <PrimaryButton title={t("track.openMaps")} variant="outline" onPress={() => void openMapsSearch(lat!, lng!)} />
          ) : destLat != null && destLng != null ? (
            <PrimaryButton
              title={t("mobile.directionsToPuja")}
              variant="outline"
              onPress={() => void openMapsDirections({ destLat, destLng, originLat: lat, originLng: lng })}
            />
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function prepLines(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return prepLines(obj.items);
    if (Array.isArray(obj.checklist)) return prepLines(obj.checklist);
    return Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v).slice(0, 80)}`);
  }
  return [String(data)];
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ["booking", id], queryFn: () => apiClient.getBooking(id), enabled: !!id });
  const prep = useQuery({ queryKey: ["prep", id], queryFn: () => apiClient.bookingPreparation(id), enabled: !!id });
  const [otp, setOtp] = useState("");
  const [completeCode, setCompleteCode] = useState("");
  const [stars, setStars] = useState("5");
  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [pujariOrigin, setPujariOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const b = q.data as Booking | undefined;
  const pujari = isPujariRole(user?.role);

  useEffect(() => {
    if (resendWait <= 0) return;
    const tmr = setTimeout(() => setResendWait((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(tmr);
  }, [resendWait]);

  useEffect(() => {
    if (!pujari) return;
    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setPujariOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
      .catch(() => undefined);
  }, [pujari]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await q.refetch();
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["start-otp"] });
      void qc.invalidateQueries({ queryKey: ["complete-otp"] });
      void qc.invalidateQueries({ queryKey: ["booking-loc"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp(kind: "start" | "complete") {
    await run(async () => {
      try {
        if (kind === "start") await apiClient.requestStartOtp(b!.id);
        else await apiClient.requestCompleteOtp(b!.id);
        setResendWait(60);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        const m = msg.match(/(\d+)\s*s/);
        if (m) setResendWait(Number(m[1]));
        throw e;
      }
    });
  }

  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.bookingTitle")} back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!b) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.bookingTitle")} back />
        <View style={{ padding: 16 }}>
          <ErrorBanner message={q.error instanceof Error ? q.error.message : t("mobile.bookingNotFound")} />
        </View>
      </Screen>
    );
  }

  const destLat = b.latitude != null ? Number(b.latitude) : null;
  const destLng = b.longitude != null ? Number(b.longitude) : null;
  const destReady = destLat != null && destLng != null && Number.isFinite(destLat) && Number.isFinite(destLng);

  return (
    <Screen>
      <ScreenHeader title={b.booking_number || t("mobile.bookingTitle")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <ErrorBanner message={error} />
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <AppText variant="h2" style={{ flex: 1 }}>
              {b.service_name}
            </AppText>
            <StatusBadge status={b.status} />
          </View>
          <AppText>{formatDisplaySlot(b.booking_date, b.start_time)}</AppText>
          <AppText color={colors.mutedForeground}>{b.location_label || b.address}</AppText>
          {pujari && b.customer_name ? <AppText>{t("mobile.customer", { name: b.customer_name })}</AppText> : null}
          {!pujari && b.pujari_name ? <AppText>{t("mobile.pujari", { name: b.pujari_name })}</AppText> : null}
          <AppText variant="price" color={colors.primary} style={{ marginTop: 4 }}>
            {rupees(b.total_paise)}
          </AppText>
          <AppText variant="small">{t("mobile.paymentStatus", { status: b.payment_status || "—" })}</AppText>
          {pujari && destReady && (b.status === "confirmed" || b.status === "in_progress") ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <AppText variant="h3">{t("detail.serviceLocation")}</AppText>
              <PrimaryButton title={t("track.openMaps")} variant="outline" onPress={() => void openMapsSearch(destLat!, destLng!)} />
              <PrimaryButton
                title={t("mobile.directionsToPuja")}
                variant="outline"
                onPress={() =>
                  void openMapsDirections({
                    destLat: destLat!,
                    destLng: destLng!,
                    originLat: pujariOrigin?.lat,
                    originLng: pujariOrigin?.lng,
                  })
                }
              />
            </View>
          ) : null}
          {pujari && b.status === "confirmed" && isPujariTrackingStarted() ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {t("mobile.trackingPermission")}
            </AppText>
          ) : null}
          {b.meeting_url ? (
            <PrimaryButton title={t("mobile.joinMeet")} variant="outline" onPress={() => void Linking.openURL(String(b.meeting_url))} />
          ) : null}
          {b.public_invite_url ? (
            <PrimaryButton title={t("mobile.inviteLink")} variant="ghost" onPress={() => void Linking.openURL(String(b.public_invite_url))} />
          ) : null}
        </Card>

        {!pujari && b.status === "confirmed" ? <CustomerStartOtp bookingId={b.id} /> : null}
        {pujari && b.status === "in_progress" ? <PujariCompleteOtp bookingId={b.id} /> : null}

        {b.mode !== "virtual" && b.status === "confirmed" ? (
          <LiveTrackCard bookingId={b.id} role={pujari ? "pujari" : "customer"} />
        ) : null}

        {prep.data ? (
          <Card>
            <AppText variant="h3">{t("mobile.preparation")}</AppText>
            {prepLines(prep.data)
              .slice(0, 12)
              .map((line) => (
                <AppText key={line} variant="small" color={colors.mutedForeground}>
                  {line}
                </AppText>
              ))}
          </Card>
        ) : null}

        {b.invoice_id ? (
          <PrimaryButton title={t("mobile.viewInvoice")} variant="outline" onPress={() => router.push(`/customer/invoice/${b.invoice_id}`)} />
        ) : null}

        {!pujari && b.payment_status === "pending" ? (
          <PrimaryButton title={t("mobile.payWallet")} disabled={busy} onPress={() => void run(() => apiClient.payBooking(b.id))} />
        ) : null}

        {!pujari && ["pending", "pending_acceptance", "confirmed"].includes(b.status) ? (
          <>
            <Field label={t("mobile.cancelReasonOptional")} value={cancelReason} onChangeText={setCancelReason} />
            <PrimaryButton
              title={t("booking.cancel")}
              variant="outline"
              disabled={busy}
              onPress={() =>
                void (async () => {
                  try {
                    const preview = (await apiClient.cancelPreview(b.id)) as {
                      refund_paise?: number;
                      fee_paise?: number;
                      message?: string;
                      allowed?: boolean;
                    };
                    Alert.alert(
                      t("mobile.cancelBookingQuestion"),
                      preview.message || `Fee ${rupees(preview.fee_paise)} · Refund ${rupees(preview.refund_paise)}. Fees are calculated by the server.`,
                      [
                        { text: t("mobile.keepBooking") },
                        {
                          text: t("booking.cancel"),
                          style: "destructive",
                          onPress: () => void run(() => apiClient.cancelBooking(b.id, cancelReason || undefined)),
                        },
                      ]
                    );
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Could not preview cancellation");
                  }
                })()
              }
            />
          </>
        ) : null}

        {!pujari && b.recurring_series_id ? (
          <PrimaryButton title={t("mobile.cancelSeries")} variant="ghost" disabled={busy} onPress={() => void run(() => apiClient.cancelRecurring(String(b.recurring_series_id)))} />
        ) : null}

        {!pujari && b.pujari_id ? (
          <PrimaryButton title={t("mobile.viewPujari")} variant="outline" onPress={() => router.push(`/pujari-public/${b.pujari_id}`)} />
        ) : null}

        {!pujari && b.status === "in_progress" ? (
          <Card style={{ gap: 8 }}>
            <AppText variant="h3">{t("mobile.verifyCompletion")}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {t("otp.completeEnter")}
            </AppText>
            <Field label={t("mobile.otp")} value={completeCode} onChangeText={setCompleteCode} keyboardType="number-pad" maxLength={8} />
            <PrimaryButton
              title={t("mobile.completePuja")}
              disabled={busy || completeCode.trim().length < 4}
              onPress={() => void run(() => apiClient.verifyCompleteOtp(b.id, completeCode.trim()))}
            />
          </Card>
        ) : null}

        {!pujari && b.status === "completed" ? (
          <>
            <AppText variant="small">{t("mobile.rating")}</AppText>
            <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
            <Field label={t("mobile.comment")} value={comment} onChangeText={setComment} />
            <PrimaryButton title={t("mobile.submitRating")} disabled={busy} onPress={() => void run(() => apiClient.rateBooking(b.id, { stars: Number(stars), comment }))} />
            <PrimaryButton title={t("mobile.skipRating")} variant="ghost" disabled={busy} onPress={() => void run(() => apiClient.rateBooking(b.id, { skip: true }))} />
          </>
        ) : null}

        {pujari && b.status === "pending_acceptance" ? (
          <>
            <PrimaryButton title={t("mobile.acceptBooking")} disabled={busy} onPress={() => void run(() => apiClient.acceptBooking(b.id))} />
            <Field label={t("mobile.rejectReason")} value={rejectReason} onChangeText={setRejectReason} />
            <PrimaryButton title={t("mobile.reject")} variant="outline" disabled={busy} onPress={() => void run(() => apiClient.rejectBooking(b.id, rejectReason))} />
          </>
        ) : null}

        {pujari && b.status === "confirmed" ? (
          <>
            <Field label={t("mobile.customerOtp")} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={8} />
            <PrimaryButton title={t("mobile.verifyStart")} disabled={busy || otp.trim().length < 4} onPress={() => void run(() => apiClient.verifyStartOtp(b.id, otp.trim()))} />
            <PrimaryButton
              title={resendWait > 0 ? t("otp.cooldown", { seconds: resendWait }) : t("otp.resend")}
              variant="outline"
              disabled={busy || resendWait > 0}
              onPress={() => void resendOtp("start")}
            />
            <Field label={t("mobile.cancelReasonOptional")} value={cancelReason} onChangeText={setCancelReason} />
            <PrimaryButton title={t("mobile.cancelServerPolicy")} variant="ghost" disabled={busy} onPress={() => void run(() => apiClient.cancelBooking(b.id, cancelReason || undefined))} />
          </>
        ) : null}

        {pujari && b.status === "in_progress" ? (
          <>
            <AppText variant="small" color={colors.mutedForeground}>
              {t("mobile.waitingCompletion")}
            </AppText>
            <PrimaryButton
              title={resendWait > 0 ? t("otp.cooldown", { seconds: resendWait }) : t("otp.resend")}
              variant="outline"
              disabled={busy || resendWait > 0}
              onPress={() => void resendOtp("complete")}
            />
          </>
        ) : null}

        {pujari && b.status === "completed" ? (
          <>
            <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
            <Field label={t("mobile.comment")} value={comment} onChangeText={setComment} />
            <PrimaryButton title={t("mobile.rateCustomer")} disabled={busy} onPress={() => void run(() => apiClient.rateBooking(b.id, { stars: Number(stars), comment }))} />
          </>
        ) : null}

        <PrimaryButton title={t("mobile.backToList")} variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
