import { rupees } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function AstrologyScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t, lang } = useI18n();
  const q = useQuery({
    queryKey: ["astrology", lang],
    queryFn: async () => {
      const astro = await apiClient.astrologyServices();
      const list = Array.isArray(astro) ? astro : (astro as { items?: CatalogService[] })?.items;
      if (list && list.length) return list as CatalogService[];
      const all = await apiClient.listServices();
      return all.filter(
        (s) =>
          String(s.category || "").toLowerCase().includes("astro") ||
          String(s.slug || "").includes("astro") ||
          String(s.slug || "").includes("muhurta") ||
          String(s.name || "").toLowerCase().includes("astro")
      );
    },
  });
  return (
    <Screen>
      <ScreenHeader title={t("mobile.astrology")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {q.isLoading ? <LoadingBlock /> : null}
        <AppText color={colors.mutedForeground}>
          {t("mobile.astrologyHelp")}
        </AppText>
        {!q.isLoading && !(q.data || []).length ? <EmptyState title={t("mobile.noAstrology")} /> : null}
        {(q.data || []).map((s) => (
          <Pressable key={s.id || s.slug} onPress={() => router.push(s.slug ? `/service/${s.slug}` : "/customer/services")}>
            <Card>
              <AppText variant="h3">{s.name}</AppText>
              {s.standard_price_paise != null || s.fee_paise != null ? (
                <AppText color={colors.primary}>{rupees(Number(s.standard_price_paise ?? s.fee_paise))}</AppText>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
