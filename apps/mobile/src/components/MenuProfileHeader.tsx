import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { fetchCustomerProfilePhotoSource } from "@/services/customerPhoto";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { isAdminRole, isPujariRole } from "@bseva/config";

function roleLabel(role: string | undefined, t: (k: string) => string) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "head_pujari") return t("auth.headPujari");
  if (isPujariRole(role)) return t("auth.pujari");
  return t("auth.customer");
}

function profileHref(role: string | undefined) {
  if (isAdminRole(role)) return "/settings";
  if (isPujariRole(role)) return "/pujari/profile";
  return "/customer/profile";
}

/** Same rule as the web pujari sidebar badge (RolePortals.tsx). */
function verificationBadge(p: Record<string, unknown>, colors: { success: string; warning?: string; primary: string }) {
  const status = String(p.profile_status || "");
  const pct = Number(p.profile_completion_percentage || 0);
  const verified = status === "verified" || (p.verification_status === "approved" && (!!p.profile_submitted_at || pct >= 100));
  const underReview =
    !verified && (status === "under_review" || status === "submitted" || p.verification_status === "under_review" || !!p.profile_submitted_at);
  if (verified) return { verified: true, labelKey: "pujari.verified", color: colors.success };
  if (underReview) return { verified: false, labelKey: "pujari.underReview", color: colors.warning || "#B7791F" };
  if (status === "ready_for_submission") return { verified: false, labelKey: "pujari.readyToSubmit", color: colors.primary };
  return { verified: false, labelKey: "pujari.notVerified", color: colors.primary };
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
  const qc = useQueryClient();
  const [photoOk, setPhotoOk] = useState(true);
  const photoQ = useQuery({
    queryKey: ["customer-photo", photoKind, user?.id],
    enabled: Boolean(user?.id && photoKind !== "none"),
    queryFn: async () => {
      if (photoKind === "customer") return await fetchCustomerProfilePhotoSource();
      if (photoKind === "pujari") return await apiClient.pujariMediaUri("photo");
      return null;
    },
    retry: false,
    staleTime: 0,
  });
  const photo = photoQ.data ?? null;
  const photoUri =
    photo && typeof photo === "object" && "uri" in photo && typeof photo.uri === "string" ? photo.uri : null;

  useFocusEffect(
    useCallback(() => {
      if (user?.id && photoKind !== "none") {
        void qc.invalidateQueries({ queryKey: ["customer-photo", photoKind, user.id] });
      }
    }, [user?.id, photoKind, qc]),
  );

  useEffect(() => {
    if (photo) setPhotoOk(true);
  }, [photo]);

  const isPujari = isPujariRole(user?.role);
  const profileQ = useQuery({
    queryKey: ["pujari-profile-badge", user?.id],
    enabled: Boolean(user?.id && isPujari),
    queryFn: () => apiClient.getPujariProfile() as Promise<Record<string, unknown>>,
    staleTime: 60_000,
  });
  const badge = isPujari && profileQ.data ? verificationBadge(profileQ.data, colors) : null;
  const rating = user?.rating;

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
          key={photoUri || "photo"}
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
          }}
        >
          <Ionicons name="person" size={36} color={colors.primary} />
        </View>
      )}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppText numberOfLines={1} style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", flexShrink: 1 }}>
            {user?.name || t("mobile.profile")}
          </AppText>
          {badge?.verified ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.success} accessibilityLabel={t("pujari.verified")} />
          ) : null}
        </View>
        {isPujari ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
              accessibilityLabel={`${(rating?.average ?? 0).toFixed(1)} out of 5, ${rating?.count ?? 0} ratings`}
            >
              <Ionicons name="star" size={13} color="#D4AF37" />
              <AppText variant="small" style={{ fontWeight: "700" }}>
                {(rating?.average ?? 0).toFixed(1)}/5 ({rating?.count ?? 0})
              </AppText>
            </View>
            {badge ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: badge.color + "22" }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badge.color }} />
                <AppText variant="small" color={badge.color} style={{ fontWeight: "700", fontSize: 11 }}>
                  {t(badge.labelKey)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
          {roleLabel(user?.role, t)}
          {user?.email || user?.phone ? ` · ${user.email || user.phone}` : ""}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}
