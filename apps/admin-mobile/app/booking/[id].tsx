import { formatDisplayDate } from "@bseva/locales";
import { displayTokenLabel, rupees } from "@bseva/config";
import type { AssignablePujari } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { AssignPujariPicker, type AvailablePujarisResponse } from "@/components/admin/AssignPujariPicker";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
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
    queryFn: () => apiClient.api<AvailablePujarisResponse>(`/admin/bookings/${id}/available-pujaris`),
    enabled: !!id && can("manage_bookings"),
  });
  const [selected, setSelected] = useState<AssignablePujari | null>(null);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = q.data as Booking | undefined;

  function requestAssign() {
    if (!selected) {
      setError("Select a pujari from the list.");
      return;
    }
    if (selected.schedule_conflict && !force) {
      Alert.alert(
        "Schedule conflict",
        `${selected.name || "This pujari"} has another confirmed booking around this time (including buffer time). Assign anyway?`,
        [{ text: "Cancel", style: "cancel" }, { text: "Assign anyway", onPress: () => void assign(selected.id, true) }],
      );
      return;
    }
    void assign(selected.id, force);
  }

  async function assign(pujariId: string, forceAssign: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(`/admin/bookings/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ pujari_id: pujariId, force_assign: forceAssign }),
      });
      setSelected(null);
      await Promise.all([q.refetch(), available.refetch()]);
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

  return (
    <Screen>
      <ScreenHeader title={b.booking_number || "Booking"} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card>
          <PujaTitle name={b.service_name} variant="h2" />
          <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
            <StatusBadge status={b.status} />
          </View>
          <AppText>Customer: {b.customer_name}</AppText>
          <AppText>Pujari: {b.pujari_name ? (["pending", "pending_acceptance"].includes(String(b.status)) ? `${b.pujari_name} (awaiting acceptance)` : b.pujari_name) : "Unassigned"}</AppText>
          <AppText>
            {`${formatDisplayDate(b.booking_date)} ${String(b.start_time || "").slice(0, 5)}`}
          </AppText>
          <AppText>{b.location_label || b.address}</AppText>
          <AppText variant="price">{rupees(b.total_paise)}</AppText>
          <AppText variant="small">Payment: {displayTokenLabel(b.payment_status, "")}</AppText>
        </Card>
        {can("manage_bookings") ? (
          <>
            <AppText variant="h3">{t("admin.assign")}</AppText>
            <AssignPujariPicker
              data={available.data}
              loading={available.isLoading}
              selectedId={selected?.id ?? null}
              onSelect={(p) => {
                setSelected(p);
                setError(null);
              }}
            />
            {available.error ? (
              <ErrorBanner message={available.error instanceof Error ? available.error.message : "Could not load pujaris"} />
            ) : null}
            <PrimaryButton title={force ? "Force Assign ON" : "Force Assign OFF"} variant="ghost" onPress={() => setForce((v) => !v)} />
            <PrimaryButton
              title={selected ? `${t("admin.assign")}: ${selected.name || "pujari"}` : t("admin.assign")}
              loading={busy}
              disabled={!selected}
              onPress={requestAssign}
            />
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
