import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { fetchCustomerProfilePhotoSource } from "@/services/customerPhoto";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { isAdminRole, isPujariRole } from "@bseva/config";

const defaultMark = require("../../assets/logo-mark.png");

function roleLabel(role: string | undefined, t: (k: string) => string) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (isPujariRole(role)) return t("auth.pujari");
  return t("auth.customer");
}

function profileHref(role: string | undefined) {
  if (isAdminRole(role)) return "/settings";
  if (isPujariRole(role)) return "/pujari/profile";
  return "/customer/profile";
}

export function MenuProfileHeader({
  photoKind = "none",
}: {
  photoKind?: "customer" | "pujari" | "none";
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [photoOk, setPhotoOk] = useState(true);
  const photoQ = useQuery({
    queryKey: ["customer-photo", photoKind, user?.id],
    enabled: Boolean(user?.id && photoKind !== "none"),
    queryFn: async () => {
      try {
        if (photoKind === "customer") return await fetchCustomerProfilePhotoSource();
        if (photoKind === "pujari") return await apiClient.pujariMediaUri("photo");
      } catch {
        return null;
      }
      return null;
    },
    retry: false,
  });
  const photo = photoQ.data ?? null;

  useEffect(() => {
    if (photo) setPhotoOk(true);
  }, [photo]);

  return (
    <Pressable
      onPress={() => router.push(profileHref(user?.role) as never)}
      accessibilityRole="button"
      accessibilityLabel={t("mobile.profile")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        minHeight: 64,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.muted,
      }}
    >
      {photo && photoOk ? (
        <Image
          source={photo}
          onError={() => setPhotoOk(false)}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.secondary }}
        />
      ) : (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.secondary,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image source={defaultMark} resizeMode="contain" style={{ width: 36, height: 36 }} />
        </View>
      )}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <AppText numberOfLines={1} style={{ fontSize: 17, lineHeight: 22, fontWeight: "700" }}>
          {user?.name || t("mobile.profile")}
        </AppText>
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
          {roleLabel(user?.role, t)}
          {user?.email || user?.phone ? ` · ${user.email || user.phone}` : ""}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}
