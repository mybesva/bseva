import { Ionicons } from "@expo/vector-icons";
import { spacing } from "@bseva/tokens";
import type { ComponentProps } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export type MoreMenuIcon = ComponentProps<typeof Ionicons>["name"];

const ICON_SLOT = 28;
const ICON_SIZE = 20;
const ROW_MIN_HEIGHT = 48;

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
