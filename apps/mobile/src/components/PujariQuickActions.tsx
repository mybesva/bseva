import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

type Action = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  iconColor: string;
  iconBg: string;
};

export function PujariQuickActions() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();

  const actions: Action[] = [
    {
      key: "bookings",
      label: t("mobile.myBookings"),
      icon: "calendar-outline",
      href: "/pujari/jobs",
      iconColor: "#2E4A6F",
      iconBg: "#E8EEF5",
    },
    {
      key: "availability",
      label: t("pujari.dashboard.setAvailability"),
      icon: "calendar-clear-outline",
      href: "/pujari/schedule",
      iconColor: "#E07A2F",
      iconBg: "#FFF0E0",
    },
    {
      key: "earnings",
      label: t("mobile.earnings"),
      icon: "wallet-outline",
      href: "/pujari/earnings",
      iconColor: "#1B7A4A",
      iconBg: "#E8F5EE",
    },
    {
      key: "documents",
      label: t("mobile.documents"),
      icon: "document-text-outline",
      href: "/pujari/documents",
      iconColor: "#6B4FA0",
      iconBg: "#F0EBF8",
    },
  ];

  return (
    <View style={{ gap: 10 }}>
      <AppText variant="h2" color={colors.navy}>
        {t("pujari.dashboard.quickActions")}
      </AppText>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => router.push(action.href as never)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border + "44",
              paddingVertical: 12,
              paddingHorizontal: 4,
              minHeight: 84,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: action.iconBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={action.icon} size={22} color={action.iconColor} />
            </View>
            <AppText
              variant="small"
              color={colors.navy}
              numberOfLines={2}
              style={{ fontWeight: "600", fontSize: 11, lineHeight: 14, textAlign: "center" }}
            >
              {action.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
