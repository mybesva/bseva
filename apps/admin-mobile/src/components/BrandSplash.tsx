import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const logo = require("../../assets/splash-full.png");
const CREAM = "#FFF8E7";
const HOLD_MS = 1100;

/** Full-screen launch screen with the complete official lockup (mark + B-SEVA). */
export function BrandSplash({ children }: { children: ReactNode }) {
  const [showIntro, setShowIntro] = useState(true);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const side = Math.min(Dimensions.get("window").width * 0.82, 360);

  const revealFullLogo = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    if (hold.current) return;
    hold.current = setTimeout(() => setShowIntro(false), HOLD_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hold.current) clearTimeout(hold.current);
    };
  }, []);

  return (
    <View style={styles.root}>
      {children}
      {showIntro ? (
        <View style={styles.intro} onLayout={revealFullLogo}>
          <Image
            source={logo}
            resizeMode="contain"
            onLoad={revealFullLogo}
            accessibilityLabel="BSeva"
            style={{ width: side, height: side }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
});
