import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminBookings({ mode = "physical" }: { mode?: string }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignment, setAssignment] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["admin-bookings", mode, q, status, assignment, page],
    queryFn: () =>
      apiClient.listBookingsPage({
        page,
        limit: 20,
        mode,
        q: q || undefined,
        status: status || undefined,
        assignment: assignment || undefined,
      }),
  });
  const items = list.data?.items || [];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{mode === "virtual" ? t("admin.virtualPuja") : t("admin.bookings")}</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        <Field label={t("admin.search")} value={q} onChangeText={(v) => { setQ(v); setPage(1); }} />
        <ChoiceChips
          options={[
            { id: "", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "pending_acceptance", label: "Acceptance" },
            { id: "confirmed", label: "Confirmed" },
            { id: "in_progress", label: "In progress" },
            { id: "completed", label: "Completed" },
            { id: "cancelled", label: "Cancelled" },
          ]}
          value={status}
          onChange={(v) => { setStatus(String(v)); setPage(1); }}
        />
        <ChoiceChips
          options={[
            { id: "", label: "Any assignment" },
            { id: "unassigned", label: "Unassigned" },
            { id: "assigned", label: "Assigned" },
          ]}
          value={assignment}
          onChange={(v) => { setAssignment(String(v)); setPage(1); }}
        />
        {list.isLoading ? <LoadingBlock /> : null}
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed"} /> : null}
        {items.length === 0 && !list.isLoading ? <EmptyState title="No bookings" /> : null}
        {items.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="h3">{b.service_name || b.booking_number}</AppText>
                <StatusBadge status={b.status} />
              </View>
              <AppText variant="small">{b.customer_name} · {b.pujari_name || "Unassigned"}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {b.booking_date} {b.start_time} · {rupees(b.total_paise)}
              </AppText>
            </Card>
          </Pressable>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))}><AppText>Prev</AppText></Pressable>
          <AppText variant="small">Page {page} / {list.data?.pages || 1}</AppText>
          <Pressable onPress={() => setPage((p) => p + 1)}><AppText>Next</AppText></Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
