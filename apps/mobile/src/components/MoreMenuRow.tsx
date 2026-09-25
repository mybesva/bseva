import { Ionicons } from "@expo/vector-icons";
import { LANG_ENGLISH_NAMES, LANG_LABELS, type Lang } from "@bseva/locales";
import { isLangCode } from "@bseva/config";
import { spacing } from "@bseva/tokens";
import { useState, type ComponentProps } from "react";
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { getAppPermissionStatus, requestAppPermissions } from "@/utils/permissions";

export type MoreMenuIcon = ComponentProps<typeof Ionicons>["name"];

const ICON_SLOT = 28;
const ICON_SIZE = 20;
const ROW_MIN_HEIGHT = 48;
const LANGS = Object.keys(LANG_LABELS) as Lang[];

export function MoreMenuRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
  disabled = false,
  chevron,
  badge,
}: {
  icon: MoreMenuIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  chevron?: boolean;
  badge?: number;
}) {
  const { colors } = useAppTheme();
  const showChevron = chevron ?? Boolean(onPress && !destructive);
  const tint = destructive ? colors.destructive : colors.primary;
  const text = destructive ? colors.destructive : colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled: Boolean(disabled || !onPress) }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.muted,
      })}
    >
      <View style={{ width: ICON_SLOT, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={ICON_SIZE} color={tint} />
      </View>
      <AppText
        numberOfLines={1}
        style={{
          flex: 1,
          marginLeft: spacing.md,
          fontSize: 16,
          lineHeight: 22,
          fontWeight: "500",
          color: text,
        }}
      >
        {label}
      </AppText>
      {badge ? (
        <AppText variant="small" color={colors.primary} style={{ marginRight: spacing.sm, fontWeight: "700" }}>
          {badge}
        </AppText>
      ) : null}
      {value ? (
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={1} style={{ marginRight: spacing.xs }}>
          {value}
        </AppText>
      ) : null}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      ) : (
        <View style={{ width: 18 }} />
      )}
    </Pressable>
  );
}

function showOptionSheet(title: string, options: { label: string; onPress: () => void }[], cancelLabel: string) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...options.map((option) => option.label), cancelLabel],
        cancelButtonIndex: options.length,
      },
      (index) => {
        if (index != null && index < options.length) options[index].onPress();
      }
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...options.map((option) => ({ text: option.label, onPress: option.onPress })),
    { text: cancelLabel, style: "cancel" as const },
  ]);
}

export function MoreLanguageRow() {
  const { lang, setLang, t } = useI18n();
  const { colors } = useAppTheme();
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);

  async function choose(code: Lang) {
    setOpen(false);
    setLang(code);
    if (user && isLangCode(code)) {
      try {
        await apiClient.patchMe({ preferred_language: code });
        await refresh();
      } catch {
        /* local language still applies */
      }
    }
  }

  return (
    <>
      <MoreMenuRow
        icon="globe-outline"
        label={t("mobile.language")}
        value={LANG_LABELS[lang]}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => undefined}
            style={{ backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 8, paddingBottom: 28 }}
          >
            <AppText variant="h3">{t("mobile.language")}</AppText>
            {LANGS.map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                onPress={() => void choose(code)}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: code === lang ? colors.secondary : colors.card,
                  borderWidth: 1,
                  borderColor: code === lang ? colors.primary : colors.border,
                }}
              >
                <AppText>
                  {LANG_LABELS[code]}
                  {LANG_ENGLISH_NAMES[code] !== LANG_LABELS[code] ? ` · ${LANG_ENGLISH_NAMES[code]}` : ""}
                </AppText>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 48, justifyContent: "center", alignItems: "center" }}>
              <AppText color={colors.mutedForeground}>{t("common.cancel")}</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function MoreAppearanceRow() {
  const { t } = useI18n();
  const { theme, setTheme } = useAppTheme();
  const value = theme === "dark" ? t("mobile.themeDark") : t("mobile.themeLight");

  return (
    <MoreMenuRow
      icon={theme === "dark" ? "moon-outline" : "sunny-outline"}
      label={t("mobile.appearance")}
      value={value}
      onPress={() =>
        showOptionSheet(
          t("mobile.appearance"),
          [
            { label: t("mobile.themeLight"), onPress: () => setTheme("light") },
            { label: t("mobile.themeDark"), onPress: () => setTheme("dark") },
          ],
          t("common.cancel")
        )
      }
    />
  );
}

export function MorePermissionsRow() {
  const { t } = useI18n();

  return (
    <MoreMenuRow
      icon="settings-outline"
      label={t("mobile.appPermissions")}
      onPress={() => {
        void (async () => {
          const status = await getAppPermissionStatus();
          const message = [
            `${t("mobile.permLocation")}: ${status.location}`,
            `${t("mobile.permNotifications")}: ${status.notifications}`,
            `${t("mobile.permPhotos")}: ${status.photos}`,
          ].join("\n");
          Alert.alert(t("mobile.appPermissions"), message, [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("mobile.enablePermissionsShort"),
              onPress: () => {
                void requestAppPermissions().then((result) => {
                  Alert.alert(t("mobile.appPermissions"), result);
                });
              },
            },
          ]);
        })();
      }}
    />
  );
}
