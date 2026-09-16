import { LANG_LABELS, type Lang } from "@bseva/locales";
import { isLangCode } from "@bseva/config";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const LANGS = Object.keys(LANG_LABELS) as Lang[];

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  const { user, refresh } = useAuth();
  const { colors } = useAppTheme();
  return (
    <View>
      <AppText variant="small">{t("mobile.language")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
        {LANGS.map((code) => (
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
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: lang === code ? colors.primary : colors.secondary,
            }}
          >
            <AppText variant="small" color={lang === code ? colors.primaryForeground : colors.foreground}>
              {LANG_LABELS[code]}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
