import type { SevaRegistration, ServiceType } from "@bseva/types";
import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { formatDisplaySlot } from "@/utils/formatDate";

type FilterId = "all" | ServiceType | "upcoming" | "live" | "completed";

function prasadLabel(t: (key: string) => string, status?: string | null): string | null {
  if (!status) return null;
  const key = `seva.prasad.${status}` as const;
  const msg = t(key);
  return msg !== key ? msg : null;
}

function canJoinLive(reg: SevaRegistration): boolean {
  if (!reg.join_token) return false;
  if (!["confirmed", "completed"].includes(String(reg.status || ""))) return false;
  if (String(reg.participation_mode || "") !== "online") return false;
  const eventStatus = String(reg.event_status || "").toLowerCase();
  return eventStatus === "live" || Boolean(reg.can_join_live);
}

export default function CustomerMySeva() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState<FilterId>("all");

  const queryParams = useMemo(() => {
    if (filter === "all") return {};
    if (filter === "upcoming" || filter === "live" || filter === "completed") {
      return { status_filter: filter };
    }
    return { service_type: filter };
  }, [filter]);

  const q = useQuery({
    queryKey: ["my-seva-registrations", queryParams],
    queryFn: () => apiClient.listMySevaRegistrations(queryParams),
  });

  const filterOptions = [
    { id: "all", label: t("seva.filter.all") },
    { id: "puja", label: t("seva.filter.puja") },
    { id: "chadhava", label: t("seva.filter.chadhava") },
    { id: "pravachan", label: t("seva.filter.pravachan") },
    { id: "upcoming", label: t("seva.upcoming") },
    { id: "live", label: t("seva.live") },
    { id: "completed", label: t("seva.completed") },
  ];

  const rows = (q.data || []) as SevaRegistration[];

  return (
    <Screen>
      <ScreenHeader title={t("seva.mySeva")} back />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
        >
          <ChoiceChips options={filterOptions} value={filter} onChange={(next) => setFilter(next as FilterId)} />

          {q.isLoading ? <LoadingBlock /> : null}

          {!q.isLoading && rows.length === 0 ? <EmptyState title={t("seva.noRegistrations")} /> : null}

          {rows.map((reg) => {
            const title = reg.event_title || reg.service_name || t("seva.events");
            const startIso = String(reg.event_start_at || "");
            const timePart = startIso.includes("T") ? startIso.split("T")[1]?.slice(0, 5) : null;
            const prasad = prasadLabel(t, reg.prasad_status);
            const joinReady = canJoinLive(reg);

            return (
              <Card key={reg.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <AppText variant="h3" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
                    {title}
                  </AppText>
                  <StatusBadge status={String(reg.status || "confirmed")} />
                </View>
                {reg.registration_number ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    #{reg.registration_number}
                  </AppText>
                ) : null}
                {reg.service_name ? (
                  <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
                    {reg.service_name}
                  </AppText>
                ) : null}
                {reg.temple_name ? (
                  <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
                    {reg.temple_name}
                  </AppText>
                ) : null}
                {reg.event_start_at ? (
                  <AppText variant="small">{formatDisplaySlot(reg.event_start_at, timePart)}</AppText>
                ) : null}
                {reg.total_amount_paise != null && Number(reg.total_amount_paise) > 0 ? (
                  <AppText variant="small" color={colors.primary}>
                    {rupees(Number(reg.total_amount_paise))}
                  </AppText>
                ) : (
                  <AppText variant="small" color={colors.mutedForeground}>
                    {t("seva.free")}
                  </AppText>
                )}
                {prasad ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    {t("seva.prasad")}: {prasad}
                  </AppText>
                ) : null}
                {reg.proof_released ? (
                  <AppText variant="small" color={colors.success}>
                    {t("seva.proofAvailable")}
                  </AppText>
                ) : null}
                {joinReady ? (
                  <PrimaryButton
                    title={t("seva.joinLive")}
                    onPress={() => router.push(`/join/${reg.join_token}` as never)}
                  />
                ) : null}
              </Card>
            );
          })}

          <Pressable
            onPress={() => router.push("/customer/family-sankalp")}
            style={{ marginTop: 8, paddingVertical: 12, alignItems: "center" }}
            accessibilityRole="button"
          >
            <AppText color={colors.primary} style={{ fontWeight: "700" }}>
              {t("seva.familySankalp")}
            </AppText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
