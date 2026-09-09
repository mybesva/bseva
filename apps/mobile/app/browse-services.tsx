import { rupees } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function BrowseServices() {
  const { q, slug } = useLocalSearchParams<{ q?: string; slug?: string }>();
  const [query, setQuery] = useState(q || "");
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const list = useQuery({ queryKey: ["services"], queryFn: () => apiClient.listServices() });
  const cats = useQuery({ queryKey: ["service-categories"], queryFn: () => apiClient.serviceCategories() });
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
          placeholder="Search services"
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
          {!list.isLoading && filtered.length === 0 ? <EmptyState title="No services found" /> : null}
          {filtered.map((s: CatalogService) => (
            <Pressable key={s.id} onPress={() => router.push(`/service/${s.slug}`)}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText variant="h3" style={{ flex: 1 }}>
                    {s.name}
                  </AppText>
                  {s.bookable ? <StatusBadge status="available" /> : <StatusBadge status="pending" />}
                </View>
                <AppText variant="small" color={colors.mutedForeground} numberOfLines={3} style={{ marginTop: 6 }}>
                  {s.short_description || s.description || ""}
                </AppText>
                {s.standard_price_paise != null ? (
                  <AppText variant="price" color={colors.primary} style={{ marginTop: 8 }}>
                    From {rupees(s.standard_price_paise)}
                  </AppText>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}
