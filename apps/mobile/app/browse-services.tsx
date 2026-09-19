import type { CatalogService } from "@bseva/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { PujaServiceCard } from "@/components/PujaImage";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function BrowseServices() {
  const { q, slug } = useLocalSearchParams<{ q?: string; slug?: string }>();
  const [query, setQuery] = useState(q || "");
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const list = useQuery({ queryKey: ["services", lang], queryFn: () => apiClient.listServices() });
  const cats = useQuery({ queryKey: ["service-categories", lang], queryFn: () => apiClient.serviceCategories() });
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    let rows = list.data || [];
    if (slug) rows = rows.filter((s) => s.slug === slug);
    const needle = query.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          (s.description || "").toLowerCase().includes(needle) ||
          s.slug.toLowerCase().includes(needle)
      );
    }
    if (cat !== "all") {
      rows = rows.filter((s) => String(s.category || "") === cat || String((s as { category_slugs?: string[] }).category_slugs || "").includes(cat));
    }
    return rows;
  }, [list.data, query, cat, slug]);

  return (
    <Screen>
      <ScreenHeader title={t("services.title")} back />
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("mobile.search")}
          placeholderTextColor={colors.mutedForeground}
          style={{
            backgroundColor: colors.input,
            borderRadius: 8,
            padding: 12,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ slug: "all", name: "All" }, ...(cats.data || [])].map((c) => (
            <Pressable
              key={c.slug}
              onPress={() => setCat(c.slug)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: cat === c.slug ? colors.primary : colors.secondary,
              }}
            >
              <AppText variant="small" color={cat === c.slug ? colors.primaryForeground : colors.foreground}>
                {c.name}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 32 }}>
          {list.isLoading ? <LoadingBlock /> : null}
          {!list.isLoading && filtered.length === 0 ? <EmptyState title={t("mobile.noServices")} /> : null}
          {filtered.map((s: CatalogService) => (
            <PujaServiceCard key={s.id} service={s} onPress={() => router.push(`/service/${s.slug}`)} />
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}
