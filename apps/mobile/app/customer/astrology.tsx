import { rupees } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AstrologyScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["astrology"],
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
      <ScreenHeader title="Astrology" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {q.isLoading ? <LoadingBlock /> : null}
        <AppText color={colors.mutedForeground}>
          Muhurta and astrology services use the same booking and wallet rules as pujas.
        </AppText>
        {!q.isLoading && !(q.data || []).length ? <EmptyState title="No astrology services listed." /> : null}
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
