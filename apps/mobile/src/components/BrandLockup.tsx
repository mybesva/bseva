import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";

/** Official complete BSeva artwork. Square source — never reconstruct with extra text. */
const logo = require("../../assets/logo-full.png");

export function BrandLockup({
  height,
  markSize = 44,
  style,
}: {
  height?: number;
  markSize?: number;
  light?: boolean;
  afterWordmark?: string;
  style?: StyleProp<ImageStyle>;
}) {
  const h = height ?? Math.round(markSize * 2.2);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="BSeva">
      <Image
        source={logo}
        resizeMode="contain"
        style={[{ width: h, height: h }, style]}
      />
    </View>
  );
}

export const brandLockupStyles = StyleSheet.create({
  splash: {
    width: 280,
    height: 280,
  },
});
