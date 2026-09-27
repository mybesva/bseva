import { isPujariRole, rupees } from "@bseva/config";
import { formatPujaTitleText } from "@bseva/locales";
import type { Booking, BookingPreparation, PreparationItem } from "@bseva/types";
import { normalizePreparationSections, PREPARATION_SECTION_KEYS } from "@bseva/types";
import { formatPujaDuration } from "@bseva/locales";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Share, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LegalAcceptRow } from "@/components/LegalAcceptRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PujaTitle } from "@/components/PujaTitle";
import { TrackingMap } from "@/components/TrackingMap";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { isPujariTrackingStarted } from "@/services/pujariTracking";
import { useAppTheme } from "@/theme/ThemeContext";
import { confirmDestructiveAction, showSuccessAlert } from "@/utils/actionFeedback";
import { formatDisplaySlot } from "@/utils/formatDate";
import { openMapsDirections, openMapsSearch } from "@/utils/maps";
import { useI18n } from "@/providers/I18nProvider";

type BusyAction =
  | "accept"
  | "reject"
  | "pay"
  | "cancel"
  | "cancel-series"
  | "verify-start"
  | "verify-complete"
  | "resend-start"
  | "resend-complete"
  | "rate"
  | "general"
  | null;

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

function lastUpdatedLabel(iso: string | null | undefined, justNow: string) {
  if (!iso) return justNow;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return justNow;
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
              ? `${t("track.lastUpdated")}: ${lastUpdatedLabel(ping?.recorded_at, t("mobile.justNow"))}`
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

function prepItemLabel(item: PreparationItem) {
  const name = item.label || item.name || "";
  return item.quantity != null ? `${name} — ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : name;
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ["booking", id], queryFn: () => apiClient.getBooking(id), enabled: !!id });
  const prep = useQuery({ queryKey: ["prep", id], queryFn: () => apiClient.bookingPreparation(id), enabled: !!id });
  const [otp, setOtp] = useState("");
  const [completeCode, setCompleteCode] = useState("");
  const [stars, setStars] = useState("5");
  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
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

  const busy = busyAction != null;

  async function refreshBookingData() {
    await q.refetch();
    void qc.invalidateQueries({ queryKey: ["bookings"] });
    void qc.invalidateQueries({ queryKey: ["start-otp"] });
    void qc.invalidateQueries({ queryKey: ["complete-otp"] });
    void qc.invalidateQueries({ queryKey: ["booking-loc"] });
  }

  async function run(action: BusyAction, fn: () => Promise<unknown>, onSuccess?: () => void) {
    setBusyAction(action);
    setError(null);
    try {
      await fn();
      await refreshBookingData();
      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("web.booking.actionFailed"));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAcceptBooking() {
    if (!b || busy) return;
    setBusyAction("accept");
    setError(null);
    try {
      await apiClient.acceptBooking(b.id);
      await refreshBookingData();
      showSuccessAlert(t("mobile.bookingAcceptedTitle"), t("mobile.bookingAcceptedMessage"), [
        { text: t("mobile.viewBooking") },
        {
          text: t("mobile.backToList"),
          onPress: () => router.push(pujari ? "/pujari/jobs" : "/customer/bookings"),
        },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.acceptBookingFailed"));
    } finally {
      setBusyAction(null);
    }
  }

  function handleRejectPress() {
    if (!b || busy) return;
    confirmDestructiveAction(
      t("mobile.rejectBookingQuestion"),
      t("mobile.rejectBookingMessage"),
      t("mobile.rejectBookingConfirm"),
      () => void performRejectBooking(),
      t("common.cancel"),
    );
  }

  async function performRejectBooking() {
    if (!b) return;
    setBusyAction("reject");
    setError(null);
    try {
      await apiClient.rejectBooking(b.id, rejectReason);
      await refreshBookingData();
      showSuccessAlert(t("mobile.bookingRejectedSuccess"), undefined, [
        {
          text: t("mobile.backToList"),
          onPress: () => router.push("/pujari/jobs"),
        },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.rejectBookingFailed"));
    } finally {
      setBusyAction(null);
    }
  }

  async function resendOtp(kind: "start" | "complete") {
    await run(kind === "start" ? "resend-start" : "resend-complete", async () => {
      try {
        if (kind === "start") await apiClient.requestStartOtp(b!.id);
        else await apiClient.requestCompleteOtp(b!.id);
        setResendWait(60);
        showSuccessAlert(t("mobile.otpSentSuccess"));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        const m = msg.match(/(\d+)\s*s/);
        if (m) setResendWait(Number(m[1]));
        throw e;
      }
    });
  }

  async function shareBooking() {
    try {
      await Share.share({
        title: b!.booking_number || t("mobile.bookingTitle"),
        message: `${t("web.booking.confirmed")}\n${formatPujaTitleText(b!.service_name) || ""}\n${formatDisplaySlot(b!.booking_date, b!.start_time)}\n#${b!.booking_number || b!.id}`,
      });
    } catch {
      Alert.alert(t("mobile.bookingTitle"), t("web.booking.shareFailed"));
    }
  }

  async function sharePreparation() {
    const preparation = prep.data as BookingPreparation | undefined;
    if (!preparation) return;
    const sections = normalizePreparationSections(preparation);
    const lines = [
      t("app.name"),
      t("app.tagline"),
      b!.service_name || t("mobile.samagriList"),
      b!.booking_number ? `${t("mobile.bookingTitle")}: ${b!.booking_number}` : "",
      "",
    ];
    for (const key of PREPARATION_SECTION_KEYS) {
      const items = sections[key];
      if (!items.length) continue;
      lines.push(t(`web.preparation.section.${key}`));
      for (const item of items) lines.push(`• ${prepItemLabel(item)}${item.notes ? ` — ${item.notes}` : ""}`);
      lines.push("");
    }
    if (!preparation.verified) lines.push(preparation.pending_message || t("web.preparation.pending"));
    try {
      const uri = `${FileSystem.cacheDirectory}samagri-${b!.booking_number || b!.id}.txt`;
      await FileSystem.writeAsStringAsync(uri, lines.filter(Boolean).join("\n"));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "text/plain", dialogTitle: t("mobile.samagriList") });
      } else {
        await Share.share({ message: lines.filter(Boolean).join("\n") });
      }
    } catch {
      Alert.alert(t("mobile.samagriList"), t("web.booking.shareFailed"));
    }
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
  const displayStatus = !pujari ? String(b.customer_display_status || b.status) : b.status;
  const preparation = prep.data as BookingPreparation | undefined;
  const prepSections = normalizePreparationSections(preparation);
  const selections = preparation?.selections || preparation?.selected_addons || [];

  return (
    <Screen>
      <ScreenHeader title={b.booking_number || t("mobile.bookingTitle")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <ErrorBanner message={error} />
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <PujaTitle name={b.service_name} variant="h2" style={{ flex: 1 }} />
            <StatusBadge status={displayStatus} />
          </View>
          <AppText>{formatDisplaySlot(b.booking_date, b.start_time)}</AppText>
          {b.duration_minutes ? <AppText>{t("web.booking.pujaDuration")}: {formatPujaDuration(lang, b.duration_minutes)}</AppText> : null}
          <AppText color={colors.mutedForeground}>{b.location_label || b.address}</AppText>
          {pujari && b.customer_name ? <AppText>{t("mobile.customer", { name: b.customer_name })}</AppText> : null}
          {!pujari && b.pujari_details_visible && b.pujari_name ? (
            <AppText>{t("mobile.pujari", { name: b.pujari_name })}</AppText>
          ) : null}
          {!pujari && !b.pujari_details_visible && (b.pujari_reveal_note || b.awaiting_pujari_assignment) ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {String(b.pujari_reveal_note || (b.awaiting_pujari_assignment ? t("booking.confirmedAssign") : t("booking.pujariSharedLater")))}
            </AppText>
          ) : null}
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
          {b.meeting_url && b.meeting_link_visible !== false ? (
            <PrimaryButton title={t("mobile.joinMeet")} variant="outline" onPress={() => void Linking.openURL(String(b.meeting_url))} />
          ) : null}
          {!pujari && b.mode === "virtual" && !b.meeting_url && b.meeting_reveal_note ? (
            <AppText variant="small" color={colors.mutedForeground}>{String(b.meeting_reveal_note)}</AppText>
          ) : null}
          {b.public_invite_url ? (
            <PrimaryButton title={t("mobile.inviteLink")} variant="ghost" onPress={() => void Linking.openURL(String(b.public_invite_url))} />
          ) : null}
          {!pujari ? <PrimaryButton title={t("mobile.share")} variant="ghost" onPress={() => void shareBooking()} /> : null}
        </Card>

        {!pujari && b.awaiting_pujari_assignment && !b.pujari_details_visible ? (
          <Card style={{ gap: 8 }}>
            <AppText variant="h3">{t("web.booking.confirmedAssignmentPending")}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {t("web.booking.assignmentPendingBody")}
            </AppText>
            {b.assignment_status === "offers_sent" || Number(b.offers_sent || 0) > 0 ? (
              <AppText variant="small" color={colors.mutedForeground}>{t("booking.confirmedNearby")}</AppText>
            ) : b.admin_assignment_required ? (
              <AppText variant="small" color={colors.mutedForeground}>{t("booking.confirmedAssign")}</AppText>
            ) : null}
            <PrimaryButton title={t("web.booking.connectAdmin")} variant="outline" onPress={() => router.push("/customer/support")} />
          </Card>
        ) : null}

        {!pujari && b.pujari_details_visible && b.status === "confirmed" ? <CustomerStartOtp bookingId={b.id} /> : null}
        {pujari && b.status === "in_progress" ? <PujariCompleteOtp bookingId={b.id} /> : null}

        {b.mode !== "virtual" && (pujari ? Boolean(b.pujari_id) : b.pujari_details_visible === true) && (b.status === "confirmed" || b.status === "in_progress") ? (
          <LiveTrackCard bookingId={b.id} role={pujari ? "pujari" : "customer"} />
        ) : null}

        {preparation ? (
          <Card style={{ gap: 8 }}>
            <AppText variant="h3">{t("mobile.preparation")}</AppText>
            {selections.some((item) => item.selected) ? (
              <AppText variant="small">
                {t("web.preparation.selections")}: {selections.filter((item) => item.selected).map((item) => item.label || item.key).join(" · ")}
              </AppText>
            ) : null}
            {PREPARATION_SECTION_KEYS.map((section) =>
              prepSections[section]?.length ? (
                <View key={section} style={{ gap: 4 }}>
                  <AppText variant="h3">{t(`web.preparation.section.${section}`)}</AppText>
                  {prepSections[section].map((item, index) => (
                    <AppText key={`${section}-${index}`} variant="small" color={colors.mutedForeground}>
                      • {prepItemLabel(item)}{item.notes ? ` — ${item.notes}` : ""}
                    </AppText>
                  ))}
                </View>
              ) : null
            )}
            {!preparation.verified && preparation.pending_message ? (
              <AppText variant="small" color={colors.mutedForeground}>{preparation.pending_message}</AppText>
            ) : null}
            <PrimaryButton title={`${t("mobile.share")} / ${t("web.preparation.print")}`} variant="outline" onPress={() => void sharePreparation()} />
          </Card>
        ) : null}

        {!pujari ? (
          <PrimaryButton
            title={t("web.booking.receipt")}
            variant="outline"
            onPress={() => router.push(`/customer/receipt/${b.id}`)}
          />
        ) : null}

        {b.invoice_id ? (
          <PrimaryButton
            title={t("mobile.viewInvoice")}
            variant="outline"
            onPress={() => router.push(pujari ? `/pujari/invoice/${b.invoice_id}` : `/customer/invoice/${b.invoice_id}`)}
          />
        ) : null}

        {!pujari && b.payment_status === "pending" ? (
          <PrimaryButton
            title={busyAction === "pay" ? t("mobile.processing") : t("mobile.payWallet")}
            loading={busyAction === "pay"}
            disabled={busy}
            onPress={() =>
              void run("pay", () => apiClient.payBooking(b.id), () =>
                showSuccessAlert(t("mobile.paymentSuccess")),
              )
            }
          />
        ) : null}

        {!pujari && ["pending", "pending_acceptance", "confirmed"].includes(b.status) ? (
          <>
            <Field label={t("mobile.cancelReasonOptional")} value={cancelReason} onChangeText={setCancelReason} />
            <PrimaryButton
              title={t("booking.cancel")}
              variant="outline"
              loading={busyAction === "cancel"}
              disabled={busy}
              onPress={() =>
                void (async () => {
                  if (cancelReason.trim().length < 5) {
                    setError(t("mobile.cancelReasonOptional"));
                    return;
                  }
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
                          onPress: () =>
                            void run("cancel", () => apiClient.cancelBooking(b.id, cancelReason.trim()), () =>
                              showSuccessAlert(t("mobile.bookingCancelledSuccess")),
                            ),
                        },
                      ],
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
          <PrimaryButton
            title={t("mobile.cancelSeries")}
            variant="ghost"
            loading={busyAction === "cancel-series"}
            disabled={busy}
            onPress={() =>
              void run("cancel-series", () => apiClient.cancelRecurring(String(b.recurring_series_id)), () =>
                showSuccessAlert(t("mobile.seriesCancelledSuccess")),
              )
            }
          />
        ) : null}

        {!pujari && b.pujari_details_visible && b.pujari_id ? (
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
              title={busyAction === "verify-complete" ? t("mobile.verifying") : t("mobile.completePuja")}
              loading={busyAction === "verify-complete"}
              disabled={busy || completeCode.trim().length < 4}
              onPress={() =>
                void run("verify-complete", () => apiClient.verifyCompleteOtp(b.id, completeCode.trim()), () =>
                  showSuccessAlert(t("mobile.pujaCompletedSuccess")),
                )
              }
            />
          </Card>
        ) : null}

        {!pujari && b.status === "completed" ? (
          <>
            <AppText variant="small">{t("mobile.rating")}</AppText>
            <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
            <Field label={t("mobile.comment")} value={comment} onChangeText={setComment} />
            <PrimaryButton
              title={t("mobile.submitRating")}
              loading={busyAction === "rate"}
              disabled={busy}
              onPress={() =>
                void run("rate", () => apiClient.rateBooking(b.id, { stars: Number(stars), comment }), () =>
                  showSuccessAlert(t("mobile.ratingSubmitted")),
                )
              }
            />
            <PrimaryButton
              title={t("mobile.skipRating")}
              variant="ghost"
              loading={busyAction === "rate"}
              disabled={busy}
              onPress={() => void run("rate", () => apiClient.rateBooking(b.id, { skip: true }))}
            />
          </>
        ) : null}

        {pujari && (b.status === "pending_acceptance" || b.pujari_offer_invited || b.pujari_accept_required) && !["confirmed", "in_progress", "completed", "cancelled", "rejected"].includes(b.status) ? (
          <>
            <LegalAcceptRow accepted={acceptTerms} onAcceptedChange={setAcceptTerms} />
            <PrimaryButton
              title={busyAction === "accept" ? t("mobile.accepting") : t("mobile.acceptBooking")}
              loading={busyAction === "accept"}
              disabled={busy || !acceptTerms}
              onPress={() => void handleAcceptBooking()}
            />
            <Field label={t("mobile.rejectReason")} value={rejectReason} onChangeText={setRejectReason} />
            <PrimaryButton
              title={busyAction === "reject" ? t("mobile.rejecting") : t("mobile.reject")}
              variant="outline"
              loading={busyAction === "reject"}
              disabled={busy}
              onPress={handleRejectPress}
            />
          </>
        ) : null}

        {pujari && b.status === "confirmed" ? (
          <>
            <Field label={t("mobile.customerOtp")} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={8} />
            <PrimaryButton
              title={busyAction === "verify-start" ? t("mobile.verifying") : t("mobile.verifyStart")}
              loading={busyAction === "verify-start"}
              disabled={busy || otp.trim().length < 4}
              onPress={() =>
                void run("verify-start", () => apiClient.verifyStartOtp(b.id, otp.trim()), () =>
                  showSuccessAlert(t("mobile.pujaStartedSuccess")),
                )
              }
            />
            <PrimaryButton
              title={resendWait > 0 ? t("otp.cooldown", { seconds: resendWait }) : t("otp.resend")}
              variant="outline"
              loading={busyAction === "resend-start"}
              disabled={busy || resendWait > 0}
              onPress={() => void resendOtp("start")}
            />
            <Field label={t("mobile.cancelReasonOptional")} value={cancelReason} onChangeText={setCancelReason} />
            <PrimaryButton
              title={t("mobile.cancelServerPolicy")}
              variant="ghost"
              loading={busyAction === "cancel"}
              disabled={busy}
              onPress={() => {
                if (cancelReason.trim().length < 5) {
                  setError(t("mobile.cancelReasonOptional"));
                  return;
                }
                confirmDestructiveAction(
                  t("mobile.cancelBookingQuestion"),
                  t("mobile.pujariCancelMessage"),
                  t("booking.cancel"),
                  () =>
                    void run("cancel", () => apiClient.cancelBooking(b.id, cancelReason.trim()), () =>
                      showSuccessAlert(t("mobile.bookingCancelledSuccess")),
                    ),
                  t("mobile.keepBooking"),
                );
              }}
            />
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
              loading={busyAction === "resend-complete"}
              disabled={busy || resendWait > 0}
              onPress={() => void resendOtp("complete")}
            />
          </>
        ) : null}

        {pujari && b.status === "completed" ? (
          <>
            <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
            <Field label={t("mobile.comment")} value={comment} onChangeText={setComment} />
            <PrimaryButton
              title={t("mobile.rateCustomer")}
              loading={busyAction === "rate"}
              disabled={busy}
              onPress={() =>
                void run("rate", () => apiClient.rateBooking(b.id, { stars: Number(stars), comment }), () =>
                  showSuccessAlert(t("mobile.ratingSubmitted")),
                )
              }
            />
          </>
        ) : null}

        <PrimaryButton title={t("mobile.backToList")} variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
