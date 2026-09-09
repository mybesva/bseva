import { isPujariRole, rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

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
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ["booking", id], queryFn: () => apiClient.getBooking(id), enabled: !!id });
  const prep = useQuery({ queryKey: ["prep", id], queryFn: () => apiClient.bookingPreparation(id), enabled: !!id });
  const loc = useQuery({ queryKey: ["booking-loc", id], queryFn: () => apiClient.getBookingLocation(id) as Promise<{ latitude?: number; longitude?: number }>, enabled: !!id });
  const [otp, setOtp] = useState("");
  const [stars, setStars] = useState("5");
  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = q.data as Booking | undefined;
  const pujari = isPujariRole(user?.role);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await q.refetch();
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Booking" back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!b) {
    return (
      <Screen>
        <ScreenHeader title="Booking" back />
        <View style={{ padding: 16 }}>
          <ErrorBanner message={q.error instanceof Error ? q.error.message : "Booking not found"} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={b.booking_number || "Booking"} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <ErrorBanner message={error} />
        {devOtp ? <AppText color={colors.primary}>Start OTP (dev): {devOtp}</AppText> : null}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText variant="h2">{b.service_name}</AppText>
            <StatusBadge status={b.status} />
          </View>
          <AppText>
            {b.booking_date} {b.start_time}
          </AppText>
          <AppText color={colors.mutedForeground}>{b.location_label || b.address}</AppText>
          {pujari && b.customer_name ? <AppText>Customer: {b.customer_name}</AppText> : null}
          {!pujari && b.pujari_name ? <AppText>Pujari: {b.pujari_name}</AppText> : null}
          <AppText variant="price" color={colors.primary} style={{ marginTop: 8 }}>
            {rupees(b.total_paise)}
          </AppText>
          <AppText variant="small">Payment: {b.payment_status || "—"}</AppText>
          {b.meeting_url ? (
            <PrimaryButton title="Open virtual meeting" variant="outline" onPress={() => void Linking.openURL(String(b.meeting_url))} />
          ) : null}
        </Card>
        {prep.data ? (
          <Card>
            <AppText variant="h3">Preparation</AppText>
            {prepLines(prep.data).slice(0, 12).map((line) => (
              <AppText key={line} variant="small" color={colors.mutedForeground}>
                {line}
              </AppText>
            ))}
          </Card>
        ) : null}
        {loc.data?.latitude != null ? (
          <AppText variant="small">
            Live location: {Number(loc.data.latitude).toFixed(4)}, {Number(loc.data.longitude).toFixed(4)}
          </AppText>
        ) : null}

        {!pujari && b.payment_status === "pending" ? (
          <PrimaryButton title="Pay from wallet" disabled={busy} onPress={() => void run(() => apiClient.payBooking(b.id))} />
        ) : null}

        {!pujari && ["pending", "pending_acceptance", "confirmed"].includes(b.status) ? (
          <>
            <Field label="Cancel reason (optional)" value={cancelReason} onChangeText={setCancelReason} />
            <PrimaryButton
              title="Cancel booking"
              variant="outline"
              disabled={busy}
              onPress={() =>
                void (async () => {
                  try {
                    const preview = (await apiClient.cancelPreview(b.id)) as { refund_paise?: number; fee_paise?: number; message?: string; allowed?: boolean };
                    Alert.alert(
                      "Cancel booking?",
                      preview.message || `Fee ${rupees(preview.fee_paise)} · Refund ${rupees(preview.refund_paise)}. Fees are calculated by the server.`,
                      [
                        { text: "Keep" },
                        {
                          text: "Cancel booking",
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
          <PrimaryButton title="Cancel series" variant="ghost" disabled={busy} onPress={() => void run(() => apiClient.cancelRecurring(String(b.recurring_series_id)))} />
        ) : null}

        {!pujari && b.pujari_id ? (
          <PrimaryButton title="View pujari" variant="outline" onPress={() => router.push(`/pujari-public/${b.pujari_id}`)} />
        ) : null}

        {!pujari && b.status === "completed" ? (
          <>
            <AppText variant="small">Rating</AppText>
            <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
            <Field label="Comment" value={comment} onChangeText={setComment} />
            <PrimaryButton title="Submit rating" disabled={busy} onPress={() => void run(() => apiClient.rateBooking(b.id, { stars: Number(stars), comment }))} />
            <PrimaryButton title="Skip rating" variant="ghost" disabled={busy} onPress={() => void run(() => apiClient.rateBooking(b.id, { skip: true }))} />
          </>
        ) : null}

        {pujari && b.status === "pending_acceptance" ? (
          <>
            <PrimaryButton title="Accept booking (agree to terms)" disabled={busy} onPress={() => void run(() => apiClient.acceptBooking(b.id))} />
            <Field label="Reject reason" value={rejectReason} onChangeText={setRejectReason} />
            <PrimaryButton title="Reject" variant="outline" disabled={busy} onPress={() => void run(() => apiClient.rejectBooking(b.id, rejectReason))} />
          </>
        ) : null}

        {pujari && b.status === "confirmed" ? (
          <>
            <PrimaryButton
              title="Request start OTP"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const out = (await apiClient.requestStartOtp(b.id)) as { dev_code?: string };
                  if (out?.dev_code) setDevOtp(String(out.dev_code));
                })
              }
            />
            <Field label="Customer OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
            <PrimaryButton title="Verify OTP & start" disabled={busy} onPress={() => void run(() => apiClient.verifyStartOtp(b.id, otp))} />
            <PrimaryButton
              title="Share my location"
              variant="outline"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== "granted") throw new Error("Location permission required");
                  const pos = await Location.getCurrentPositionAsync({});
                  await apiClient.updateBookingLocation(b.id, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                })
              }
            />
            <Field label="Cancel reason" value={cancelReason} onChangeText={setCancelReason} />
            <PrimaryButton title="Cancel (server policy)" variant="ghost" disabled={busy} onPress={() => void run(() => apiClient.cancelBooking(b.id, cancelReason || undefined))} />
          </>
        ) : null}

        {pujari && b.status === "in_progress" ? (
          <PrimaryButton title="Complete puja" disabled={busy} onPress={() => void run(() => apiClient.completeBooking(b.id))} />
        ) : null}

        {pujari && b.status === "completed" ? (
          <>
            <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
            <Field label="Comment" value={comment} onChangeText={setComment} />
            <PrimaryButton title="Rate customer" disabled={busy} onPress={() => void run(() => apiClient.rateBooking(b.id, { stars: Number(stars), comment }))} />
          </>
        ) : null}

        <PrimaryButton title="Back to list" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
