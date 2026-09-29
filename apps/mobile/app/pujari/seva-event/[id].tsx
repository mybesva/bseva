import type { SevaEvent } from "@bseva/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

type Participant = {
  registration_number?: string;
  primary_name?: string;
  gotra?: string;
  gotra_unknown?: boolean;
  sankalp_text?: string;
  package_name?: string;
  participation_mode?: string;
  family_members?: Array<{ name?: string; relationship?: string }>;
};

export default function PujariSevaEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["pujari-seva-event", id],
    queryFn: () => apiClient.pujariSevaEventDetail(String(id)),
    enabled: !!id,
  });
  const complete = useMutation({
    mutationFn: () => apiClient.pujariCompleteSevaEvent(String(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pujari-seva-events"] });
      void qc.invalidateQueries({ queryKey: ["pujari-seva-event", id] });
    },
  });

  const ev = q.data as (SevaEvent & {
    participants?: Participant[];
    operational_meet_url?: string;
    operational_invite_url?: string;
    temple_address?: string;
  }) | undefined;
  const isPravachan = ev?.service_type === "pravachan";
  const isGroupPuja = ev?.puja_event_kind === "group_live";
  const showSankalp = isGroupPuja || ev?.puja_event_kind === "proxy";
  const canComplete = ev && !["completed", "cancelled"].includes(String(ev.status || ""));

  return (
    <Screen>
      <ScreenHeader title={t("seva.pujari.eventDetail")} back />
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : t("common.retry")} /> : null}
      {ev ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <AppText variant="h2">{ev.title || ev.service_name}</AppText>
          <AppText color={colors.mutedForeground}>
            {ev.service_type === "pravachan" ? t("seva.pravachan") : ev.puja_event_kind === "proxy" ? t("seva.proxyPuja") : ev.puja_event_kind === "group_live" ? t("seva.groupLivePuja") : t("seva.puja")}
          </AppText>

          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
            <AppText variant="eyebrow">{t("seva.pujari.schedule")}</AppText>
            <AppText>{String(ev.start_at || "").slice(0, 16).replace("T", " ")}</AppText>
            {ev.end_at ? <AppText color={colors.mutedForeground}>{String(ev.end_at).slice(0, 16).replace("T", " ")}</AppText> : null}
          </View>

          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
            <AppText variant="eyebrow">{t("seva.pujari.venue")}</AppText>
            <AppText>{ev.temple_name || "—"}</AppText>
            {ev.temple_city ? <AppText color={colors.mutedForeground}>{ev.temple_city}</AppText> : null}
            {ev.temple_address ? <AppText color={colors.mutedForeground}>{ev.temple_address}</AppText> : null}
          </View>

          {ev.participation_mode ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              <AppText variant="eyebrow">{t("seva.participationMode")}</AppText>
              <AppText>{t(`seva.${ev.participation_mode}` as "seva.offline" | "seva.online" | "seva.hybrid")}</AppText>
              {ev.online_enabled && (ev.participation_mode === "online" || ev.participation_mode === "hybrid") ? (
                <>
                  <AppText color={colors.mutedForeground} style={{ marginTop: 8 }}>{t("seva.pujari.meetOps")}</AppText>
                  {ev.operational_meet_url ? (
                    <View style={{ marginTop: 8 }}>
                      <PrimaryButton
                        title={t("seva.joinLive")}
                        onPress={() => void Linking.openURL(ev.operational_meet_url!)}
                      />
                    </View>
                  ) : (
                    <AppText color={colors.mutedForeground}>{t("seva.pujari.meetPending")}</AppText>
                  )}
                </>
              ) : null}
            </View>
          ) : null}

          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
            <AppText variant="eyebrow">{t("seva.pujari.participantCount")}</AppText>
            <AppText variant="h3">{ev.registration_count ?? ev.participants?.length ?? 0}</AppText>
          </View>

          {showSankalp && (ev.participants || []).length > 0 ? (
            <View style={{ gap: 8 }}>
              <AppText variant="h3">{t("seva.pujari.sankalpManifest")}</AppText>
              {(ev.participants || []).map((p, idx) => (
                <View
                  key={p.registration_number || String(idx)}
                  style={{ backgroundColor: colors.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border }}
                >
                  <AppText variant="eyebrow">{p.primary_name || "—"}</AppText>
                  <AppText color={colors.mutedForeground}>
                    {p.gotra_unknown ? t("seva.gotraUnknown") : p.gotra || "—"}
                    {p.package_name ? ` · ${p.package_name}` : ""}
                  </AppText>
                  {p.sankalp_text ? <AppText style={{ marginTop: 4 }}>{p.sankalp_text}</AppText> : null}
                  {(p.family_members || []).length > 0 ? (
                    <AppText color={colors.mutedForeground} style={{ marginTop: 4 }}>
                      {(p.family_members || []).map((m) => m.name).filter(Boolean).join(", ")}
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {isPravachan && (ev.participants || []).length > 0 ? (
            <View style={{ gap: 8 }}>
              <AppText variant="h3">{t("seva.pujari.attendees")}</AppText>
              {(ev.participants || []).map((p, idx) => (
                <AppText key={p.registration_number || String(idx)} color={colors.mutedForeground}>
                  {p.primary_name || p.registration_number} · {p.participation_mode === "online" ? t("seva.online") : t("seva.offline")}
                </AppText>
              ))}
            </View>
          ) : null}

          {canComplete ? (
            <PrimaryButton
              title={t("seva.pujari.markComplete")}
              loading={complete.isPending}
              onPress={() => complete.mutate()}
            />
          ) : (
            <AppText color={colors.mutedForeground}>{t(`seva.${ev.status === "completed" ? "completed" : "cancelled"}` as "seva.completed")}</AppText>
          )}
        </ScrollView>
      ) : null}
    </Screen>
  );
}
