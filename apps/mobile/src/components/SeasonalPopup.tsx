import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, View } from "react-native";
import { AppText, PrimaryButton } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

const SEEN_KEY = "bseva_seasonal_popup_seen_v2";

export function SeasonalPopup() {
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const q = useQuery({
    queryKey: ["promo-popups", lang],
    queryFn: () => apiClient.promoPopups(lang),
  });
  const popup = q.data?.[0];

  useEffect(() => {
    if (!popup?.id && !popup?.title) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SEEN_KEY);
        const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        const last = Number(seen[popup.id || ""] || 0);
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (last && Date.now() - last < weekMs) return;
        if (!cancelled) setVisible(true);
      } catch {
        if (!cancelled) setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [popup?.id, popup?.title]);

  async function dismiss() {
    setVisible(false);
    if (!popup?.id) return;
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY);
      const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      seen[popup.id] = Date.now();
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* ignore */
    }
  }

  if (!popup || !visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void dismiss()}>
      <Pressable
        onPress={() => void dismiss()}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}
      >
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.card, borderRadius: 16, overflow: "hidden" }}>
          {popup.image_url ? (
            <Image source={{ uri: apiClient.mediaUrl(popup.image_url) }} resizeMode="contain" style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.secondary }} />
          ) : null}
          <View style={{ padding: 16, gap: 10 }}>
            <AppText variant="h3">{popup.title || t("web.promo.untitled")}</AppText>
            {popup.description ? <AppText variant="small" color={colors.mutedForeground}>{popup.description}</AppText> : null}
            <PrimaryButton title={t("common.close")} variant="outline" onPress={() => void dismiss()} />
            {popup.cta_url ? (
              <PrimaryButton
                title={popup.cta_label || t("common.view")}
                onPress={() => {
                  void Linking.openURL(popup.cta_url!);
                  void dismiss();
                }}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
