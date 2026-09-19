import type { CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { PujaServiceCard } from "@/components/PujaImage";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function CustomerServices() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["services", lang], queryFn: () => apiClient.listServices() });
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list.data || [];
    return (list.data || []).filter((s) => s.name.toLowerCase().includes(needle));
  }, [list.data, q]);
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.services")}</AppText>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("mobile.search")}
          placeholderTextColor={colors.mutedForeground}
          style={{ marginTop: 12, backgroundColor: colors.input, borderRadius: 8, padding: 12, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
        />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {list.isLoading ? <LoadingBlock /> : null}
        {filtered.length === 0 && !list.isLoading ? <EmptyState title={t("mobile.noServices")} /> : null}
        {filtered.map((s: CatalogService) => (
          <PujaServiceCard key={s.id} service={s} onPress={() => router.push(`/service/${s.slug}`)} />
        ))}
      </ScrollView>
    </Screen>
  );
}
