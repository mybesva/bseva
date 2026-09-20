import { formatPujaTitleText, stripPujaTitleMarks } from "@bseva/locales";
import { typography } from "@bseva/tokens";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useAppTheme } from "@/theme/ThemeContext";

type PujaTitleProps = {
  name?: string | null;
  variant?: keyof typeof typography;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  onDark?: boolean;
};

export function PujaTitle({
  name,
  variant = "h3",
  numberOfLines,
  style,
  onDark = false,
}: PujaTitleProps) {
  const { colors, theme } = useAppTheme();
  const clean = stripPujaTitleMarks(name);
  if (!clean) return null;
  const size = typography[variant].fontSize;
  const symbolSize = Math.round(size * 0.82);
  const nameColor = onDark || theme === "dark" ? colors.cream : "#1A2B4A";
  return (
    <Text
      accessibilityLabel={formatPujaTitleText(clean)}
      numberOfLines={numberOfLines}
      style={[{ flexShrink: 1 }, style]}
    >
      <Text style={{ color: colors.primary, fontSize: symbolSize, fontWeight: "600" }}>ॐ </Text>
      <Text style={{ color: nameColor, fontSize: size, fontWeight: "700", lineHeight: typography[variant].lineHeight }}>
        {clean}
      </Text>
      <Text style={{ color: colors.primary, fontSize: symbolSize, fontWeight: "600" }}> 卐</Text>
    </Text>
  );
}
