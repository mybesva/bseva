import { rupees } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerServices() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["services"], queryFn: () => apiClient.listServices() });
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list.data || [];
    return (list.data || []).filter((s) => s.name.toLowerCase().includes(needle));
  }, [list.data, q]);
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">Services</AppText>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={colors.mutedForeground}
          style={{ marginTop: 12, backgroundColor: colors.input, borderRadius: 8, padding: 12, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
        />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {list.isLoading ? <LoadingBlock /> : null}
        {filtered.length === 0 && !list.isLoading ? <EmptyState title="No services" /> : null}
        {filtered.map((s: CatalogService) => (
          <Pressable key={s.id} onPress={() => router.push(`/service/${s.slug}`)}>
            <Card>
              <AppText variant="h3">{s.name}</AppText>
              <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
                {s.short_description || ""}
              </AppText>
              {s.standard_price_paise != null ? (
                <AppText color={colors.primary} style={{ marginTop: 6, fontWeight: "700" }}>
                  {rupees(s.standard_price_paise)}
                </AppText>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
