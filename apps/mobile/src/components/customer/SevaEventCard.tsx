import type { SevaEvent } from "@bseva/types";
import { rupees } from "@bseva/config";
import { Pressable, View } from "react-native";
import { AppText, Card } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { formatDisplaySlot } from "@/utils/formatDate";

function eventStatusLabel(t: (key: string) => string, event: SevaEvent): string {
  const status = String(event.display_status || event.status || "").toLowerCase();
  if (status.includes("live")) return t("seva.live");
  if (status.includes("cancel")) return t("seva.cancelled");
  if (status.includes("complete")) return t("seva.completed");
  return t("seva.upcoming");
}

function participationLabel(t: (key: string) => string, mode?: string | null): string {
  if (mode === "online") return t("seva.online");
  if (mode === "hybrid") return t("seva.hybrid");
  return t("seva.offline");
}

/** Seva event card. Opens the event registration screen (never the Puja booking wizard). */
export function SevaEventCard({ event, onPress }: { event: SevaEvent; onPress: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const title = event.title || event.service_name || t("seva.events");
  const startIso = String(event.start_at || "");
  const timePart = startIso.includes("T") ? startIso.split("T")[1]?.slice(0, 5) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <AppText variant="h3" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
            {eventStatusLabel(t, event)}
          </AppText>
        </View>
        {event.service_name ? (
          <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
            {event.service_name}
          </AppText>
        ) : null}
        {event.temple_name ? (
          <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
            {event.temple_name}
            {event.temple_city ? ` · ${event.temple_city}` : ""}
          </AppText>
        ) : null}
        <AppText variant="small">{formatDisplaySlot(event.start_at, timePart)}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <AppText variant="small" color={colors.mutedForeground}>
            {participationLabel(t, event.participation_mode)}
          </AppText>
          <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
            {event.is_free ? t("seva.free") : event.price_paise != null ? rupees(Number(event.price_paise)) : t("seva.paid")}
          </AppText>
          {event.sold_out ? (
            <AppText variant="small" color={colors.destructive}>
              {t("seva.soldOut")}
            </AppText>
          ) : event.seats_remaining != null ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {t("seva.seatsRemaining", { count: String(event.seats_remaining) })}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
