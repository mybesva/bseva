import type { SevaEvent } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

function eventKindLabel(ev: SevaEvent, t: (k: string) => string): string {
  if (ev.puja_event_kind === "group_live") return t("seva.groupLivePuja");
  if (ev.puja_event_kind === "proxy") return t("seva.proxyPuja");
  if (ev.service_type === "chadhava") return t("seva.chadhava");
  if (ev.service_type === "pravachan") return t("seva.pravachan");
  return t("seva.puja");
}

export default function PujariSevaEventsScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const q = useQuery({ queryKey: ["pujari-seva-events"], queryFn: () => apiClient.pujariSevaEvents() });

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("seva.pujari.eventsTitle")}</AppText>
        <AppText color={colors.mutedForeground} style={{ marginTop: 4 }}>
          {t("seva.pujari.eventsSubtitle")}
        </AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {(q.data || []).length === 0 && !q.isLoading ? <EmptyState title={t("seva.noEvents")} /> : null}
        {(q.data || []).map((ev: SevaEvent) => (
          <TouchableOpacity
            key={ev.id}
            onPress={() => router.push(`/pujari/seva-event/${ev.id}` as never)}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText variant="h3">{ev.title || ev.service_name}</AppText>
            <AppText color={colors.mutedForeground} style={{ marginTop: 4 }}>
              {eventKindLabel(ev, t)}
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <AppText color={colors.mutedForeground}>{String(ev.start_at || "").slice(0, 16).replace("T", " ")}</AppText>
              {ev.participation_mode ? (
                <AppText color={colors.mutedForeground}>
                  · {t(`seva.${ev.participation_mode}` as "seva.offline" | "seva.online" | "seva.hybrid")}
                </AppText>
              ) : null}
            </View>
            <AppText style={{ marginTop: 6 }}>
              {ev.temple_name || ev.temple_city || "—"}
            </AppText>
            <AppText color={colors.mutedForeground} style={{ marginTop: 4 }}>
              {ev.registration_count ?? 0}
              {ev.capacity ? ` / ${ev.capacity}` : ""} · {t(`seva.${ev.display_status || "upcoming"}` as "seva.upcoming")}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}
