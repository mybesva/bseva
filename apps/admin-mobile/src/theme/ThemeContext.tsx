import { createContext, useContext, type ReactNode } from "react";
import { colors, type ColorTokens, type ThemeName } from "@bseva/tokens";

type ThemeContextValue = {
  theme: ThemeName;
  colors: ColorTokens;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeContextView({
  value,
  children,
}: {
  value: ThemeContextValue;
  children: ReactNode;
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider missing");
  return ctx;
}

export { colors };
