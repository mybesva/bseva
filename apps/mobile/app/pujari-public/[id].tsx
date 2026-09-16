import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

function asList(v: unknown): string {
  if (Array.isArray(v)) return v.filter(Boolean).map(String).join(", ");
  if (typeof v === "string" && v.trim()) {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.filter(Boolean).map(String).join(", ");
    } catch {
      return v;
    }
  }
  return "";
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  const { colors } = useAppTheme();
  if (value === undefined || value === null || value === "") return null;
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="small" color={colors.mutedForeground}>
        {label}
      </AppText>
      <AppText>{String(value)}</AppText>
    </View>
  );
}

export default function PublicPujari() {
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const q = useQuery({
    queryKey: ["public-pujari", id, lang],
    queryFn: () => apiClient.publicPujari(id!) as Promise<Record<string, unknown>>,
    enabled: !!id,
  });
  const p = q.data || {};
  const loc = [p.city, p.district, p.state].filter(Boolean).join(", ");

  return (
    <Screen>
      <ScreenHeader title={t("mobile.pujariTitle")} back />
      {q.isLoading ? <LoadingBlock /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <ErrorBanner message={q.isError ? (q.error instanceof Error ? q.error.message : t("mobile.pujariNotFound")) : null} />
        {q.data ? (
          <Card>
            <AppText variant="h2">{String(p.name || p.full_name || t("mobile.pujariTitle"))}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {t("mobile.level", { level: String(p.approved_level ?? "—") })}
            </AppText>
            <View style={{ height: 12 }} />
            <Row label={t("mobile.location")} value={loc || String(p.location_label || "")} />
            <Row label={t("mobile.experience")} value={p.experience_years != null ? t("mobile.experienceYears", { count: Number(p.experience_years) }) : null} />
            <Row
              label={t("mobile.ratingValue")}
              value={p.avg_stars != null ? `★ ${Number(p.avg_stars).toFixed(1)} (${p.rating_count || 0})` : null}
            />
            <Row label={t("mobile.sampradaya")} value={p.sampradaya ? String(p.sampradaya) : null} />
            <Row label={t("mobile.gotra")} value={p.gotra ? String(p.gotra) : null} />
            <Row label={t("mobile.languages")} value={asList(p.languages)} />
            <Row label={t("mobile.specializations")} value={asList(p.specializations)} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
