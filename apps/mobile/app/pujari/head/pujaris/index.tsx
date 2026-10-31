import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Row = {
  id: string;
  public_id?: string | null;
  name: string;
  location?: string | null;
  verification_status?: string | null;
};

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "correction_required", label: "Correction" },
  { id: "rejected", label: "Rejected" },
];

/** Read-only list. Only Admin can verify or change a pujari. */
export default function HeadPujariDirectory() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const list = useQuery({
    queryKey: ["head-pujari-directory", q, status],
    queryFn: () =>
      apiClient.api<{ items: Row[] }>(
        `/head/pujari-directory?page_size=50${q ? `&q=${encodeURIComponent(q)}` : ""}${status === "all" ? "" : `&status=${status}`}`,
      ),
  });
  const rows = list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title="Pujari Directory" back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        <ErrorBanner message={list.error instanceof Error ? list.error.message : null} />
        <Field label="Search" value={q} onChangeText={setQ} />
        <ChoiceChips options={STATUS_FILTERS} value={status} onChange={(next) => setStatus(String(next))} />
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? <EmptyState title="No pujaris found" /> : null}
        {rows.map((row) => (
          <Pressable key={row.id} onPress={() => router.push(`/pujari/head/pujaris/${row.id}` as never)}>
            <Card style={{ gap: 4 }}>
              <AppText variant="h3">{row.name}</AppText>
              {row.public_id ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {row.public_id}
                </AppText>
              ) : null}
              {row.location ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {row.location}
                </AppText>
              ) : null}
              <StatusBadge status={String(row.verification_status || "pending")} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
