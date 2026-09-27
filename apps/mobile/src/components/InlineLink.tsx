import { useRouter } from "expo-router";
import { Text, type TextStyle } from "react-native";
import { useAppTheme } from "@/theme/ThemeContext";

type InlineLinkProps = {
  label: string;
  href?: string;
  onPress?: () => void;
  style?: TextStyle;
};

/** Tappable inline text link — must be nested inside Text/AppText for inline layout. */
export function InlineLink({ label, href, onPress, style }: InlineLinkProps) {
  const { colors } = useAppTheme();
  const router = useRouter();

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    if (href) router.push(href as never);
  }

  return (
    <Text
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={label}
      suppressHighlighting={false}
      style={[
        {
          color: colors.primary,
          textDecorationLine: "underline",
          fontWeight: "600",
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}
