import { Ionicons } from "@expo/vector-icons";
import { spacing } from "@bseva/tokens";
import { useEffect, useRef, type ComponentProps } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
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

const APPEARANCE_TOGGLE_WIDTH = 50;
const APPEARANCE_TOGGLE_HEIGHT = 30;
const APPEARANCE_KNOB_SIZE = 24;
const APPEARANCE_TOGGLE_PAD = 3;
const APPEARANCE_KNOB_TRAVEL =
  APPEARANCE_TOGGLE_WIDTH - APPEARANCE_KNOB_SIZE - APPEARANCE_TOGGLE_PAD * 2;

function AppearanceThemeToggle({
  theme,
  onToggle,
  accessibilityLabel,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useAppTheme();
  const isDark = theme === "dark";
  const slide = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: isDark ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isDark, slide]);

  const knobX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, APPEARANCE_KNOB_TRAVEL],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={accessibilityLabel}
      onPress={onToggle}
      hitSlop={8}
    >
      <View
        style={{
          width: APPEARANCE_TOGGLE_WIDTH,
          height: APPEARANCE_TOGGLE_HEIGHT,
          borderRadius: APPEARANCE_TOGGLE_HEIGHT / 2,
          backgroundColor: isDark ? colors.navy : colors.cream,
          borderWidth: 1,
          borderColor: isDark ? colors.navy : `${colors.border}99`,
          padding: APPEARANCE_TOGGLE_PAD,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: APPEARANCE_KNOB_SIZE,
            height: APPEARANCE_KNOB_SIZE,
            borderRadius: APPEARANCE_KNOB_SIZE / 2,
            backgroundColor: colors.primary,
            transform: [{ translateX: knobX }],
            shadowColor: "#000",
            shadowOpacity: 0.14,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        />
      </View>
    </Pressable>
  );
}

export function MoreAppearanceRow() {
  const { t } = useI18n();
  const { theme, toggleTheme, colors } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.muted,
      }}
    >
      <View style={{ width: ICON_SLOT, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="sunny-outline" size={ICON_SIZE} color={colors.primary} />
      </View>
      <AppText
        numberOfLines={1}
        style={{
          flex: 1,
          marginLeft: spacing.md,
          fontSize: 16,
          lineHeight: 22,
          fontWeight: "500",
          color: colors.foreground,
        }}
      >
        {t("mobile.appearance")}
      </AppText>
      <AppearanceThemeToggle
        theme={theme}
        onToggle={toggleTheme}
        accessibilityLabel={`${t("mobile.appearance")}, ${theme === "dark" ? t("mobile.themeDark") : t("mobile.themeLight")}`}
      />
    </View>
  );
}
