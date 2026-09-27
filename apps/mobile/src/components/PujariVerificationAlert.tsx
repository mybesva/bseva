import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { pujariVerificationAlertTarget } from "@/utils/pujariVerification";

export function PujariVerificationAlert({ profile }: { profile: Record<string, unknown> }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const target = pujariVerificationAlertTarget(profile);

  return (
    <Pressable
      onPress={() => router.push(target as never)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#FEF2F2",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#FECACA",
        paddingHorizontal: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#FEE2E2",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="alert-circle" size={22} color="#DC2626" />
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <AppText style={{ fontWeight: "700", fontSize: 14, color: colors.navy }} numberOfLines={1}>
          {t("pujari.dashboard.completeProfile")}
        </AppText>
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
          {t("pujari.dashboard.completeProfileHint")}
        </AppText>
      </View>
      <View
        style={{
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 36,
          justifyContent: "center",
        }}
      >
        <AppText style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 13 }}>
          {t("pujari.dashboard.completeCta")} ›
        </AppText>
      </View>
    </Pressable>
  );
}
