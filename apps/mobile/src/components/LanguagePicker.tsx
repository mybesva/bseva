import { LANG_LABELS, type Lang } from "@bseva/locales";
import { isLangCode } from "@bseva/config";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const LANGS = Object.keys(LANG_LABELS) as Lang[];

export function LanguagePicker({ variant = "default" }: { variant?: "default" | "landing" }) {
  const { lang, setLang, t } = useI18n();
  const { user, refresh } = useAuth();
  const { colors } = useAppTheme();
  const isLanding = variant === "landing";

  return (
    <View>
      <AppText
        variant="small"
        color={isLanding ? colors.navy : undefined}
        style={isLanding ? { fontWeight: "700", marginBottom: 2 } : undefined}
      >
        {t("mobile.language")}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
        {LANGS.map((code) => {
          const selected = lang === code;
          return (
            <Pressable
              key={code}
              onPress={async () => {
                setLang(code);
                if (user && isLangCode(code)) {
                  try {
                    await apiClient.patchMe({ preferred_language: code });
                    await refresh();
                  } catch {
                    /* local language still applies */
                  }
                }
              }}
              style={{
                paddingHorizontal: isLanding ? 14 : 12,
                paddingVertical: isLanding ? 9 : 8,
                borderRadius: isLanding ? 999 : 8,
                backgroundColor: selected
                  ? colors.primary
                  : isLanding
                    ? "#F4E4C1"
                    : colors.secondary,
                borderWidth: isLanding && !selected ? StyleSheet.hairlineWidth : 0,
                borderColor: isLanding ? "rgba(212,175,55,0.45)" : "transparent",
              }}
            >
              <AppText
                variant="small"
                color={selected ? colors.primaryForeground : colors.foreground}
                style={isLanding ? { fontWeight: selected ? "700" : "600" } : undefined}
              >
                {LANG_LABELS[code]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
