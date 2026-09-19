import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  right,
}: {
  title: ReactNode;
  back?: boolean;
  notificationsHref?: string;
  right?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
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
        <View style={{ flex: 1 }}>
          {typeof title === "string" ? (
            <AppText variant="h3" color={colors.cream} numberOfLines={1}>
              {title}
            </AppText>
          ) : (
            title
          )}
        </View>
        {notificationsHref ? (
          <Pressable
            onPress={() => router.push(notificationsHref as never)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.notifications")}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.cream} />
          </Pressable>
        ) : null}
        {right}
      </View>
    </SafeAreaView>
  );
}

export function HomeBrandBar({
  notificationsHref,
  subtitle,
}: {
  notificationsHref?: string;
  subtitle?: string;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <BrandLockup height={88} />
          {subtitle ? (
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {notificationsHref ? (
          <Pressable
            onPress={() => router.push(notificationsHref as never)}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.notifications")}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.navy} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
