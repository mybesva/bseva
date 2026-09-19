import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { useAppTheme } from "@/theme/ThemeContext";

const logo = require("../../assets/logo-full.png");

/** Subtle official BSeva artwork. Non-interactive; does not replace page content. */
export function BrandWatermark() {
  const { theme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height) * 0.58;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image
        source={logo}
        resizeMode="contain"
        style={{
          position: "absolute",
          width: size,
          height: size,
          left: (width - size) / 2,
          top: (height - size) / 2,
          opacity: theme === "dark" ? 0.045 : 0.055,
        }}
      />
    </View>
  );
}
