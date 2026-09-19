import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { isAdminRole } from "@bseva/config";

const defaultMark = require("../../assets/logo-mark.png");

function roleLabel(role: string | undefined) {
  if (role === "super_admin") return "Super Admin";
  if (isAdminRole(role)) return "Admin";
  return "Admin";
}

export function MenuProfileHeader() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const initials = (user?.name || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <Pressable
      onPress={() => router.push("/settings")}
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
        {initials ? (
          <AppText variant="h3" color={colors.navy}>
            {initials}
          </AppText>
        ) : (
          <Image source={defaultMark} resizeMode="contain" style={{ width: 36, height: 36 }} />
        )}
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <AppText numberOfLines={1} style={{ fontSize: 17, lineHeight: 22, fontWeight: "700" }}>
          {user?.name || t("mobile.profile")}
        </AppText>
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
          {roleLabel(user?.role)}
          {user?.email ? ` · ${user.email}` : ""}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}
