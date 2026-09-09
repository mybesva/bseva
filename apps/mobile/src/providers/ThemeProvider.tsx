import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { colors, THEME_KEY, type ThemeName } from "@bseva/tokens";
import { ThemeContextView } from "@/theme/ThemeContext";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [theme, setThemeState] = useState<ThemeName>(system === "dark" ? "dark" : "light");

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") setThemeState(stored);
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      colors: colors[theme],
      setTheme: (next: ThemeName) => {
        setThemeState(next);
        void AsyncStorage.setItem(THEME_KEY, next);
      },
      toggleTheme: () => {
        setThemeState((prev) => {
          const next = prev === "light" ? "dark" : "light";
          void AsyncStorage.setItem(THEME_KEY, next);
          return next;
        });
      },
    }),
    [theme]
  );

  return <ThemeContextView value={value}>{children}</ThemeContextView>;
}
