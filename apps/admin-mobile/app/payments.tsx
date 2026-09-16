import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function AdminPayments() {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = useQuery({
    queryKey: ["admin-payments", q, status],
    queryFn: () => apiClient.listBookingsPage({ page: 1, limit: 40, stats: true, q: q || undefined, payment_status: status || undefined }),
  });
  return (
    <Screen>
      <ScreenHeader title={t("admin.payments")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        <ChoiceChips
          options={[{ id: "", label: "All" }, { id: "paid", label: "Paid" }, { id: "pending", label: "Pending" }, { id: "failed", label: "Failed" }, { id: "refunded", label: "Refunded" }]}
          value={status}
          onChange={(v) => setStatus(String(v))}
        />
        {list.isLoading ? <LoadingBlock /> : null}
        {(list.data?.items || []).map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)}>
            <Card>
              <StatusBadge status={String(b.payment_status || "pending")} />
              <AppText variant="h3">{b.service_name}</AppText>
              <AppText>{rupees(b.total_paise)} · {b.customer_name}</AppText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
