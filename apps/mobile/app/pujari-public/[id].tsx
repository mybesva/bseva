import { rupees } from "@bseva/config";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PublicPujari() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const q = useQuery({
    queryKey: ["public-pujari", id],
    queryFn: () => apiClient.publicPujari(id) as Promise<Record<string, unknown>>,
    enabled: !!id,
  });
  const p = q.data || {};
  return (
    <Screen>
      <ScreenHeader title="Pujari" back />
      {q.isLoading ? <LoadingBlock /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Card>
          <AppText variant="h2">{String(p.name || p.full_name || "Pujari")}</AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            Level {String(p.approved_level ?? "—")} · {String(p.city || p.location_label || "")}
          </AppText>
          <AppText>{String(p.sampradaya || "")}</AppText>
          <AppText variant="small">Experience {String(p.experience_years ?? "—")} years</AppText>
          {p.avg_stars != null ? <AppText>Rating {String(p.avg_stars)} ({String(p.rating_count || 0)})</AppText> : null}
          {p.gotra ? <AppText variant="small">Gotra {String(p.gotra)}</AppText> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
