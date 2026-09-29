import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

type StatItem = {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

function StatCard({ item, compact }: { item: StatItem; compact: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: compact ? "100%" : "46%",
        maxWidth: compact ? "100%" : "48%",
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: compact ? 10 : 12,
        gap: 6,
        minHeight: compact ? 88 : 96,
        shadowColor: colors.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: item.iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
        {item.label}
      </AppText>
      <AppText
        variant="h3"
        color={colors.foreground}
        numberOfLines={1}
        style={{ fontSize: compact ? 18 : 20, lineHeight: compact ? 22 : 24 }}
      >
        {item.value}
      </AppText>
      <AppText variant="small" color={colors.mutedForeground} numberOfLines={2} style={{ fontSize: 11, lineHeight: 14 }}>
        {item.hint}
      </AppText>
    </View>
  );
}

export function PujariStatGrid({
  totalDakshina,
  monthDakshina,
  monthLabel,
  upcomingCount,
  pendingCount,
  completedCount,
  completedEarnings,
}: {
  totalDakshina: string;
  monthDakshina: string;
  monthLabel: string;
  upcomingCount: number;
  pendingCount: number;
  completedCount: number;
  completedEarnings: string;
}) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const compact = width < 340;

  const items = useMemo<StatItem[]>(
    () => [
      {
        label: t("mobile.totalDakshina"),
        value: totalDakshina,
        hint: t("mobile.totalDakshinaHint"),
        icon: "cash-outline",
        iconColor: "#FF7A00",
        iconBg: "#FFF0E0",
      },
      {
        label: t("mobile.thisMonthDakshina"),
        value: monthDakshina,
        hint: monthLabel,
        icon: "trending-up-outline",
        iconColor: "#1B7A4A",
        iconBg: "#E8F5EE",
      },
      {
        label: t("mobile.upcoming"),
        value: String(upcomingCount),
        hint: t("mobile.upcomingHint", { count: String(pendingCount) }),
        icon: "hourglass-outline",
        iconColor: "#1A2B4A",
        iconBg: "#E8EEF5",
      },
      {
        label: t("mobile.completedEarnings"),
        value: String(completedCount),
        hint: t("pujari.dashboard.completedEarned", { amount: completedEarnings }),
        icon: "checkmark-circle-outline",
        iconColor: "#1B7A4A",
        iconBg: "#E8F5EE",
      },
    ],
    [t, totalDakshina, monthDakshina, monthLabel, upcomingCount, pendingCount, completedCount, completedEarnings],
  );

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
      {items.map((item) => (
        <StatCard key={item.label} item={item} compact={compact} />
      ))}
    </View>
  );
}
