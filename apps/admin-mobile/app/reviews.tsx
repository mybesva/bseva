import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, ErrorBanner, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { formatDisplayDateTime } from "@bseva/locales";

type ReviewRow = {
  id: string;
  customer_name?: string | null;
  priest_name?: string | null;
  puja_type?: string | null;
  stars: number;
  comment?: string | null;
  booking_date?: string | null;
  created_at?: string | null;
  status?: string;
};

export default function AdminReviews() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => apiClient.api<ReviewRow[]>("/admin/reviews"),
  });

  const rows = (list.data || []).filter((row) => {
    const hay = `${row.customer_name || ""} ${row.priest_name || ""} ${row.puja_type || ""} ${row.comment || ""}`.toLowerCase();
    const query = q.trim().toLowerCase();
    return !query || hay.includes(query);
  });

  return (
    <Screen>
      <ScreenHeader title={t("admin.reviews")} back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed to load reviews"} /> : null}
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? <EmptyState title="No reviews available." /> : null}
        {rows.map((review) => (
          <Card key={review.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <AppText variant="h3" style={{ flex: 1 }}>
                {review.customer_name || "Customer"}
              </AppText>
              <StatusBadge status={review.status || "approved"} />
            </View>
            <AppText>{review.priest_name || "—"} · {review.puja_type || "Puja"}</AppText>
            <AppText variant="price">{review.stars}/5</AppText>
            {review.comment ? <AppText variant="small">{review.comment}</AppText> : null}
            <AppText variant="small">
              {formatDisplayDateTime(review.created_at || review.booking_date)}
            </AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
