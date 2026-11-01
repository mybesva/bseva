import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback } from "react";
import { useAppTheme } from "@/theme/ThemeContext";

/** Dark status-bar icons while a light (cream) screen is focused; restores the app default (light) on blur. */
export function useDarkStatusBarWhileFocused() {
  const { theme } = useAppTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(theme === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [theme]),
  );
}
