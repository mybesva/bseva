import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, View, useWindowDimensions } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { pujariBookingsHref } from "@/utils/pujariBookings";

const SAFFRON = "#FF7A00";

type StatItem = {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  href: Href;
  /** Saffron call-to-action card (booking requests waiting on the pujari). */
  highlight?: boolean;
};

function StatCard({ item, compact }: { item: StatItem; compact: boolean }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const hi = !!item.highlight;
  const fg = hi ? "#FFFFFF" : colors.foreground;
  const muted = hi ? "rgba(255,255,255,0.88)" : colors.mutedForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}: ${item.value}`}
      onPress={() => router.push(item.href)}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: compact ? "100%" : "46%",
        maxWidth: compact ? "100%" : "48%",
        backgroundColor: hi ? SAFFRON : colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: hi ? "#E86A00" : colors.border,
        padding: compact ? 12 : 14,
        gap: 6,
        minHeight: compact ? 96 : 108,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        shadowColor: hi ? "#E86A00" : "#78400A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: hi ? 0.3 : 0.1,
        shadowRadius: 14,
        elevation: 2,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hi ? "rgba(255,255,255,0.22)" : item.iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={item.icon} size={20} color={hi ? "#FFFFFF" : item.iconColor} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={muted} />
      </View>
      <AppText variant="small" color={muted} numberOfLines={1} style={hi ? { fontWeight: "700" } : undefined}>
        {item.label}
      </AppText>
      <AppText
        variant="h3"
        color={fg}
        numberOfLines={1}
        style={{ fontSize: compact ? 20 : 22, lineHeight: compact ? 24 : 27, fontWeight: "800" }}
      >
        {item.value}
      </AppText>
      <AppText variant="small" color={muted} numberOfLines={2} style={{ fontSize: 11, lineHeight: 14 }}>
        {item.hint}
      </AppText>
    </Pressable>
  );
}

/**
 * Pujari home stats: booking requests (tap → Bookings filtered to pending, where they can accept/reject),
 * upcoming, a single Dakshina card, and completed pujas.
 */
export function PujariStatGrid({
  requestCount,
  scheduledCount,
  monthDakshina,
  totalDakshina,
  completedCount,
  completedEarnings,
}: {
  requestCount: number;
  scheduledCount: number;
  monthDakshina: string;
  totalDakshina: string;
  completedCount: number;
  completedEarnings: string;
}) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const compact = width < 340;

  const items: StatItem[] = [
    {
      key: "requests",
      label: t("pd.requests"),
      value: String(requestCount),
      hint: requestCount > 0 ? t("pd.requestsHint") : t("pd.requestsNone"),
      icon: "notifications-outline",
      iconColor: SAFFRON,
      iconBg: "#FFF0E0",
      href: pujariBookingsHref("upcoming", "pending"),
      highlight: requestCount > 0,
    },
    {
      key: "upcoming",
      label: t("mobile.upcoming"),
      value: String(scheduledCount),
      hint: t("pd.upcomingHint"),
      icon: "calendar-outline",
      iconColor: "#1A2B4A",
      iconBg: "#E8EEF5",
      href: pujariBookingsHref("upcoming", "confirmed"),
    },
    {
      key: "dakshina",
      label: t("pd.dakshina"),
      value: monthDakshina,
      hint: t("pd.dakshinaTotal", { amount: totalDakshina }),
      icon: "wallet-outline",
      iconColor: "#1B7A4A",
      iconBg: "#E8F5EE",
      href: "/pujari/earnings" as Href,
    },
    {
      key: "completed",
      label: t("pd.completed"),
      value: String(completedCount),
      hint: t("pujari.dashboard.completedEarned", { amount: completedEarnings }),
      icon: "checkmark-circle-outline",
      iconColor: "#1B7A4A",
      iconBg: "#E8F5EE",
      href: pujariBookingsHref("completed", "all"),
    },
  ];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
      {items.map((item) => (
        <StatCard key={item.key} item={item} compact={compact} />
      ))}
    </View>
  );
}
