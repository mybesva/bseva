import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLockup } from "@/components/BrandLockup";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { AppText } from "./ui";

export function ScreenHeader({
  title,
  back,
  notificationsHref,
}: {
  title: string;
  back?: boolean;
  notificationsHref?: string;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.navy }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.navy,
          minHeight: 52,
        }}
      >
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.back")}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.cream} />
          </Pressable>
        ) : null}
        <AppText variant="h3" color={colors.cream} style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </AppText>
        {notificationsHref ? (
          <Pressable
            onPress={() => router.push(notificationsHref as never)}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.notifications")}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.cream} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function HomeBrandBar({ subtitle, right }: { subtitle?: string; right?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <BrandLockup height={88} />
          {subtitle ? (
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    </SafeAreaView>
  );
}
