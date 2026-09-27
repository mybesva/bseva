import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";

/** Full lockup with tagline — login, splash, marketing. */
const logoFull = require("../../assets/logo-full.png");
/** Mark + wordmark only — compact app headers. */
const logoCompact = require("../../assets/logo.png");

export function BrandLockup({
  height,
  markSize = 44,
  style,
  variant = "full",
}: {
  height?: number;
  markSize?: number;
  light?: boolean;
  afterWordmark?: string;
  style?: StyleProp<ImageStyle>;
  /** `compact` drops the tagline so the mark reads clearly in nav bars. */
  variant?: "full" | "compact";
}) {
  const h = height ?? (variant === "compact" ? 60 : Math.round(markSize * 2.2));
  const source = variant === "compact" ? logoCompact : logoFull;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="B-Seva">
      <Image source={source} resizeMode="contain" style={[{ width: h, height: h }, style]} />
    </View>
  );
}

export const brandLockupStyles = StyleSheet.create({
  splash: {
    width: 280,
    height: 280,
  },
});
