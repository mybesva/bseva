import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLockup } from "@/components/BrandLockup";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { AppText } from "./ui";

function UnreadBell({ color, onPress, label }: { color: string; onPress: () => void; label: string }) {
  const q = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => apiClient.unreadNotificationCount(),
    refetchInterval: 30_000,
  });
  const refetchUnread = q.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchUnread();
    }, [refetchUnread]),
  );
  const count = Number(q.data?.unread ?? q.data?.count ?? 0);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count}` : label}
      style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="notifications-outline" size={24} color={color} />
      {count > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            right: 0,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 3,
            backgroundColor: "#C2410C",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, lineHeight: 12, fontWeight: "700" }}>{count > 99 ? "99+" : String(count)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

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
          <UnreadBell
            color={colors.cream}
            label={t("mobile.notifications")}
            onPress={() => router.push(notificationsHref as never)}
          />
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
          <UnreadBell
            color={colors.navy}
            label={t("mobile.notifications")}
            onPress={() => router.push(notificationsHref as never)}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
