import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

// Once per app session, like the web prompt (PujariProfileGate) uses sessionStorage.
let promptedThisSession = false;

async function photoMissing(profile: Record<string, unknown>): Promise<boolean> {
  if (!profile.profile_photo_path) return true;
  try {
    const src = await apiClient.pujariMediaUri("photo");
    const res = await fetch(src.uri, { method: "GET", headers: src.headers });
    return !res.ok;
  } catch {
    // Network trouble is not proof the photo is missing; don't nag.
    return false;
  }
}

/**
 * Profile photo is mandatory: remind pujaris who finished their profile but have no usable photo.
 * Incomplete profiles are handled by the verification alert instead (same split as the web).
 */
export function PujariPhotoPrompt({ profile }: { profile: Record<string, unknown> | undefined }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile || promptedThisSession) return;
    const complete = !!profile.profile_submitted_at || Number(profile.profile_completion_percentage ?? 0) >= 100;
    if (!complete) return;
    let cancelled = false;
    void photoMissing(profile).then((missing) => {
      if (cancelled || !missing || promptedThisSession) return;
      promptedThisSession = true;
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable
        onPress={() => setOpen(false)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}
      >
        <Pressable onPress={() => undefined}>
          <Card style={{ gap: 12 }}>
            <AppText variant="h3" color={colors.primary}>
              {t("pujari.photo.requiredTitle")}
            </AppText>
            <AppText color={colors.mutedForeground} style={{ lineHeight: 21 }}>
              {t("web.validation.profilePhoto")}
            </AppText>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={t("web.profile.later")} variant="outline" onPress={() => setOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={t("pujari.photo.uploadNow")}
                  onPress={() => {
                    setOpen(false);
                    router.push("/pujari/profile");
                  }}
                />
              </View>
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
