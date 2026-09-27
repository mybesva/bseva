import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useRouter } from "expo-router";
import { useCallback, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLockup } from "@/components/BrandLockup";
import { useAuth } from "@/providers/AuthProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
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
          <Text style={{ color: "#fff", fontSize: 10, lineHeight: 12, fontWeight: "700" }}>
            {count > 99 ? "99+" : String(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function HeaderProfileAvatar({ onPress, label }: { onPress: () => void; label: string }) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const initial = (user?.name || "?").slice(0, 1).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.secondary,
          borderWidth: 2,
          borderColor: colors.primary + "55",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AppText style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>{initial}</AppText>
      </View>
      <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

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
  const nav = useRouter();
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
          <UnreadBell
            color={colors.cream}
            label={t("mobile.notifications")}
            onPress={() => nav.push(notificationsHref as never)}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function HomeBrandBar({
  title,
  subtitle,
  notificationsHref = "/notifications",
  profileHref = "/profile",
  right,
}: {
  title?: string;
  subtitle?: string;
  notificationsHref?: string;
  profileHref?: string;
  right?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const nav = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <BrandLockup variant="compact" height={60} />
          {title ? (
            <AppText variant="h3" color={colors.navy} numberOfLines={1} style={{ marginTop: 2 }}>
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1} style={{ marginTop: title ? 1 : 0 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {notificationsHref ? (
          <UnreadBell
            color={colors.navy}
            label={t("mobile.notifications")}
            onPress={() => nav.push(notificationsHref as never)}
          />
        ) : null}
        <HeaderProfileAvatar label={t("mobile.profile")} onPress={() => nav.push(profileHref as never)} />
        {right}
      </View>
    </SafeAreaView>
  );
}
