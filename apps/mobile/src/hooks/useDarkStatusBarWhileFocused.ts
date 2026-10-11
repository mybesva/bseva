import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback } from "react";

/** Dark status-bar icons while a light (cream) screen is focused; restores the app default (light) on blur. */
export function useDarkStatusBarWhileFocused() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("dark");
      return () => setStatusBarStyle("light");
    }, []),
  );
}
