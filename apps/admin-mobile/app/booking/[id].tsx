import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function AdminBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["booking", id], queryFn: () => apiClient.getBooking(id), enabled: !!id });
  const available = useQuery({
    queryKey: ["available-pujaris", id],
    queryFn: () => apiClient.api<{ id: string; name?: string; distance_km?: number }[]>(`/admin/bookings/${id}/available-pujaris`),
    enabled: !!id && can("manage_bookings"),
  });
  const [pujariId, setPujariId] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = q.data as Booking | undefined;

  async function assign() {
    if (!pujariId.trim()) {
      setError("Pujari ID is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(`/admin/bookings/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ pujari_id: pujariId, force_assign: force }),
      });
      await q.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("admin.bookings")} back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!b) {
    return (
      <Screen>
        <ScreenHeader title={t("admin.bookings")} back />
        <ErrorBanner message="Booking not found" />
      </Screen>
    );
  }

  const rows = Array.isArray(available.data) ? available.data : [];

  return (
    <Screen>
      <ScreenHeader title={b.booking_number || "Booking"} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <PujaTitle name={b.service_name} variant="h2" />
            <StatusBadge status={b.status} />
          </View>
          <AppText>Customer: {b.customer_name}</AppText>
          <AppText>Pujari: {b.pujari_name || "Unassigned"}</AppText>
          <AppText>
            {b.booking_date} {b.start_time}
          </AppText>
          <AppText>{b.location_label || b.address}</AppText>
          <AppText variant="price">{rupees(b.total_paise)}</AppText>
          <AppText variant="small">Payment: {b.payment_status}</AppText>
        </Card>
        {can("manage_bookings") ? (
          <>
            <AppText variant="h3">{t("admin.assign")}</AppText>
            <Field label="Pujari ID" value={pujariId} onChangeText={setPujariId} placeholder="Select below or enter ID" />
            {rows.slice(0, 12).map((p) => (
              <PrimaryButton
                key={p.id}
                title={`${p.name || p.id}${p.distance_km != null ? ` · ${p.distance_km} km` : ""}`}
                variant={pujariId === p.id ? "primary" : "outline"}
                onPress={() => setPujariId(p.id)}
              />
            ))}
            <PrimaryButton title={force ? "Force assign ON" : "Force assign OFF"} variant="ghost" onPress={() => setForce((v) => !v)} />
            <PrimaryButton title={t("admin.assign")} loading={busy} onPress={() => void assign()} />
            <PrimaryButton
              title="No-show penalty"
              variant="outline"
              onPress={() =>
                Alert.alert("No-show penalty", "Apply the configured no-show penalty?", [
                  { text: "Cancel" },
                  {
                    text: "Apply",
                    onPress: () =>
                      void apiClient
                        .api(`/bookings/${id}/no-show-penalty`, { method: "POST", body: JSON.stringify({ waive: false, reason: "admin" }) })
                        .then(() => q.refetch())
                        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed")),
                  },
                ])
              }
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
