import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge, SuccessBanner } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDateTime } from "@bseva/locales";

type Direction = "customer_to_pujari" | "pujari_to_customer";

type ReviewRow = {
  id: string;
  booking_number?: string | null;
  role_from?: string;
  customer_name?: string | null;
  priest_name?: string | null;
  puja_type?: string | null;
  stars: number;
  comment?: string | null;
  booking_date?: string | null;
  created_at?: string | null;
  status?: string;
};

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: "customer_to_pujari", label: "Customer → Pujari" },
  { id: "pujari_to_customer", label: "Pujari → Customer" },
];
const STATUS_OPTIONS = [
  { id: "all", label: "All Status" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];
const RATING_OPTIONS = [
  { id: "all", label: "All Ratings" },
  { id: "5", label: "5 Stars" },
  { id: "4", label: "4 Stars" },
  { id: "3", label: "3 Stars" },
  { id: "2", label: "2 Stars" },
  { id: "1", label: "1 Star" },
];

export default function AdminReviews() {
  const { t } = useI18n();
  const { can } = useAdmin();
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState<Direction>("customer_to_pujari");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Moderation applies to customer -> pujari reviews (those feed the public rating).
  const canManage = can("manage_reviews") && direction === "customer_to_pujari";

  const list = useQuery({
    queryKey: ["admin-reviews", direction],
    queryFn: () => apiClient.api<ReviewRow[]>(`/admin/reviews?direction=${direction}`),
  });
  const all = list.data || [];

  const rows = all.filter((row) => {
    const hay = `${row.customer_name || ""} ${row.priest_name || ""} ${row.puja_type || ""} ${row.comment || ""}`.toLowerCase();
    const query = q.trim().toLowerCase();
    const matchesSearch = !query || hay.includes(query);
    const matchesStatus = statusFilter === "all" || (row.status || "pending") === statusFilter;
    const matchesRating = ratingFilter === "all" || Number(row.stars) === parseInt(ratingFilter, 10);
    return matchesSearch && matchesStatus && matchesRating;
  });

  const average = all.length === 0 ? "0.0" : (all.reduce((s, r) => s + Number(r.stars || 0), 0) / all.length).toFixed(1);
  const pending = all.filter((r) => r.status === "pending").length;
  const approved = all.filter((r) => r.status === "approved").length;

  async function moderate(review: ReviewRow, action: "approve" | "reject") {
    setBusyId(review.id);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.api<{ status?: string }>(`/admin/reviews/${review.id}/${action}`, { method: "POST" });
      await list.refetch();
      setSuccess(action === "approve" ? "Review approved" : "Review rejected");
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : `Could not ${action} review`);
    } finally {
      setBusyId(null);
    }
  }

  const stats: [string, string | number][] = [
    ["Total", all.length],
    ["Average", average],
    ["Pending", pending],
    ["Approved", approved],
  ];

  return (
    <Screen>
      <ScreenHeader title={t("admin.reviews")} back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed to load reviews"} /> : null}
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {stats.map(([label, value]) => (
            <Card key={label} compact style={{ flex: 1, alignItems: "center" }}>
              <AppText variant="h3">{value}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {label}
              </AppText>
            </Card>
          ))}
        </View>
        <ChoiceChips options={DIRECTIONS} value={direction} onChange={(v) => setDirection(v as Direction)} horizontal />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} placeholder="Search by customer, priest, or puja type..." />
        <ChoiceChips options={STATUS_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(String(v))} horizontal />
        <ChoiceChips options={RATING_OPTIONS} value={ratingFilter} onChange={(v) => setRatingFilter(String(v))} horizontal />
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? <EmptyState title="No reviews match these filters." /> : null}
        {rows.map((review) => (
          <Card key={review.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <AppText variant="h3" style={{ flex: 1 }}>
                {review.customer_name || "Customer"}
              </AppText>
              <StatusBadge status={review.status || "pending"} />
            </View>
            {review.booking_number ? (
              <AppText variant="small" color={colors.mutedForeground}>
                {review.booking_number}
              </AppText>
            ) : null}
            <AppText>
              {direction === "customer_to_pujari" ? "Rated pujari: " : "Rated by pujari: "}
              {review.priest_name || "—"} · {review.puja_type || "Puja"}
            </AppText>
            <AppText variant="price">{review.stars}/5</AppText>
            {review.comment ? <AppText variant="small">{review.comment}</AppText> : null}
            <AppText variant="small">{formatDisplayDateTime(review.created_at || review.booking_date)}</AppText>
            {canManage && review.status === "pending" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Approve"
                    loading={busyId === review.id}
                    disabled={busyId !== null}
                    onPress={() => void moderate(review, "approve")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Reject"
                    variant="outline"
                    disabled={busyId !== null}
                    onPress={() => void moderate(review, "reject")}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
