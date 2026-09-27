import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLockup } from "@/components/BrandLockup";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { fetchCustomerProfilePhotoSource } from "@/services/customerPhoto";
import { useAppTheme } from "@/theme/ThemeContext";
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

function HeaderProfileAvatar({
  onPress,
  label,
  photoKind = "customer",
}: {
  onPress: () => void;
  label: string;
  photoKind?: "customer" | "pujari";
}) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const [photoOk, setPhotoOk] = useState(true);
  const photoQ = useQuery({
    queryKey: ["customer-photo", photoKind, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (photoKind === "customer") return await fetchCustomerProfilePhotoSource();
      return await apiClient.pujariMediaUri("photo");
    },
    retry: false,
    staleTime: 0,
  });
  const photo = photoQ.data ?? null;
  const photoUri =
    photo && typeof photo === "object" && "uri" in photo && typeof photo.uri === "string" ? photo.uri : null;
  const initial = (user?.name || "?").slice(0, 1).toUpperCase();

  useFocusEffect(
    useCallback(() => {
      if (user?.id) void qc.invalidateQueries({ queryKey: ["customer-photo", photoKind, user.id] });
    }, [user?.id, photoKind, qc]),
  );

  useEffect(() => {
    if (photo) setPhotoOk(true);
  }, [photo]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 }}
    >
      {photo && photoOk ? (
        <Image
          key={photoUri || "photo"}
          source={photo}
          onError={() => setPhotoOk(false)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.secondary,
            borderWidth: 2,
            borderColor: colors.primary + "55",
          }}
        />
      ) : (
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
      )}
      <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
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
  profileHref = "/customer/profile",
}: {
  notificationsHref?: string;
  subtitle?: string;
  profileHref?: string;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
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
        <HeaderProfileAvatar
          label={t("mobile.profile")}
          onPress={() => router.push(profileHref as never)}
        />
      </View>
    </SafeAreaView>
  );
}
