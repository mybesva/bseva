import { ADMIN_PAYMENT_STATUS_FILTERS, rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { GatewayPaymentsPanel } from "@/components/admin/payments/GatewayPaymentsPanel";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function AdminPayments() {
  const { t } = useI18n();
  const router = useRouter();
  const { can } = useAdmin();
  const showGateway = can("view_financials");
  const params = useLocalSearchParams<{ status?: string }>();
  const [view, setView] = useState<"bookings" | "gateway">("bookings");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const statusOptions = useMemo(
    () => [
      ...ADMIN_PAYMENT_STATUS_FILTERS,
      { id: "refund_pending", label: "Refund Pending" },
      { id: "refund_requested", label: "Refund Requested" },
    ],
    []
  );

  useEffect(() => {
    const next = typeof params.status === "string" ? params.status : "";
    if (next) setStatus(next);
  }, [params.status]);
  const list = useQuery({
    queryKey: ["admin-payments", q, status],
    queryFn: () => apiClient.listBookingsPage({ page: 1, limit: 40, stats: true, q: q || undefined, payment_status: status || undefined }),
    enabled: view === "bookings",
  });
  const rows = list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.payments")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {showGateway ? (
          <ChoiceChips
            options={[
              { id: "bookings", label: "Booking payments" },
              { id: "gateway", label: "Gateway" },
            ]}
            value={view}
            onChange={(v) => setView(String(v) as "bookings" | "gateway")}
          />
        ) : null}
        {view === "gateway" && showGateway ? (
          <GatewayPaymentsPanel />
        ) : (
          <>
            <Field label={t("admin.search")} value={q} onChangeText={setQ} />
            <ChoiceChips options={statusOptions} value={status} onChange={(v) => setStatus(String(v))} />
            <ErrorBanner message={list.error instanceof Error ? list.error.message : null} />
            {list.isLoading ? <LoadingBlock /> : null}
            {!list.isLoading && !list.error && rows.length === 0 ? <EmptyState title="No payments match these filters." /> : null}
            {rows.map((b: Booking) => (
              <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)}>
                <Card>
                  <StatusBadge status={String(b.payment_status || "pending")} />
                  <PujaTitle name={b.service_name} variant="h3" style={{ flex: 1 }} />
                  <AppText>{rupees(b.total_paise)} · {b.customer_name}</AppText>
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
