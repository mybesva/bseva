import { Ionicons } from "@expo/vector-icons";
import type { Booking } from "@bseva/types";
import { formatTime } from "@bseva/locales";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { PujaTitle } from "@/components/PujaTitle";
import { AppText, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { bookingLocationLabel } from "@/utils/pujariBookings";

export function PujariTodaySchedule({
  bookings,
  onViewCalendar,
}: {
  bookings: Booking[];
  onViewCalendar: () => void;
}) {
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <AppText variant="h2" color={colors.navy}>
          {t("pujari.dashboard.todaySchedule")}
        </AppText>
        <Pressable
          onPress={onViewCalendar}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, minHeight: 44, justifyContent: "center" })}
        >
          <AppText color={colors.primary} style={{ fontWeight: "700", fontSize: 13 }}>
            {t("pujari.dashboard.viewCalendar")} ›
          </AppText>
        </Pressable>
      </View>

      {bookings.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border + "44",
            paddingVertical: 20,
            paddingHorizontal: 16,
            alignItems: "center",
          }}
        >
          <Ionicons name="sunny-outline" size={28} color={colors.mutedForeground} />
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 8, textAlign: "center" }}>
            {t("pujari.dashboard.noScheduleToday")}
          </AppText>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border + "44",
            overflow: "hidden",
          }}
        >
          {bookings.map((booking, index) => {
            const location = bookingLocationLabel(booking);
            const timeLabel = formatTime(booking.start_time, lang);
            const isLast = index === bookings.length - 1;
            return (
              <Pressable
                key={booking.id}
                onPress={() => router.push(`/pujari/booking/${booking.id}`)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  minHeight: 64,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: colors.border + "33",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 68, alignItems: "flex-start" }}>
                  <AppText
                    style={{
                      fontWeight: "700",
                      fontSize: 13,
                      color: booking.status === "confirmed" || booking.status === "in_progress" ? colors.primary : colors.mutedForeground,
                    }}
                    numberOfLines={1}
                  >
                    {timeLabel}
                  </AppText>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <PujaTitle name={booking.service_name} variant="small" style={{ fontWeight: "700" }} numberOfLines={1} />
                  {location ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                      <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
                        {location}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <StatusBadge status={booking.status} />
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
