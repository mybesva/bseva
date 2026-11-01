import type { SevaRegistration } from "@bseva/types";
import { rupees, sevaTypeLabel } from "@bseva/config";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, Card, PrimaryButton, StatusBadge } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { formatDisplaySlot } from "@/utils/formatDate";

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

export function SevaRegistrationCard({ reg }: { reg: SevaRegistration }) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppTheme();
    const title = reg.event_title || reg.service_name || t("seva.events");
    const startIso = String(reg.event_start_at || "");
    const timePart = startIso.includes("T") ? startIso.split("T")[1]?.slice(0, 5) : null;
    const prasad = prasadLabel(t, reg.prasad_status);
    const joinReady = canJoinLive(reg);


  return (
    <Card style={{ gap: 6 }}>
      <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
        {sevaTypeLabel(reg.service_type)}
      </AppText>
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
}
