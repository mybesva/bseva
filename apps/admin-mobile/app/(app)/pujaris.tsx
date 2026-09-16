import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type PujariRow = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  verification_status?: string;
  approved_level?: number;
  blocked?: boolean;
};

export default function AdminPujaris() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["admin-pujaris", q, status, page],
    queryFn: () =>
      apiClient.api<{ items?: PujariRow[]; pages?: number }>(
        `/admin/pujaris?page=${page}&page_size=20${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`
      ),
  });
  const items = list.data?.items || [];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("admin.pujaris")}</AppText>
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
            { id: "approved", label: "Approved" },
            { id: "correction_required", label: "Correction" },
            { id: "rejected", label: "Rejected" },
            { id: "blocked", label: "Blocked" },
          ]}
          value={status}
          onChange={(v) => { setStatus(String(v)); setPage(1); }}
        />
        {list.isLoading ? <LoadingBlock /> : null}
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed"} /> : null}
        {items.length === 0 && !list.isLoading ? <EmptyState title="No pujaris" /> : null}
        {items.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(`/pujari/${p.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="h3">{p.name}</AppText>
                <StatusBadge status={p.verification_status || (p.blocked ? "blocked" : "pending")} />
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                {p.email} · L{p.approved_level ?? "—"}
              </AppText>
            </Card>
          </Pressable>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))}><AppText>Prev</AppText></Pressable>
          <AppText variant="small">Page {page}</AppText>
          <Pressable onPress={() => setPage((p) => p + 1)}><AppText>Next</AppText></Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
