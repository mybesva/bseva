import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const logo = require("../../assets/logo.png");

export function BrandSplash({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const scale = useSharedValue(0.78);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    opacity.value = withTiming(1, { duration: 450 });
    translateY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 11, stiffness: 130 });
    const t = setTimeout(() => setDone(true), 1800);
    return () => clearTimeout(t);
  }, [opacity, scale, translateY]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <View style={{ flex: 1 }}>
      {children}
      {done ? null : (
        <View style={styles.overlay}>
          <Animated.Image source={logo} resizeMode="contain" style={[styles.logo, anim]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A2B4A",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  logo: {
    width: 280,
    height: 280,
  },
});
