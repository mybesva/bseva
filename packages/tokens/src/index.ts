/** BSeva design tokens — shared identity, not web/DOM components. */

export const colors = {
  light: {
    primary: "#FF9933",
    primaryForeground: "#1A2B4A",
    navy: "#1A2B4A",
    gold: "#D4AF37",
    cream: "#FFF8E7",
    terracotta: "#C65D3B",
    background: "#FFF8E7",
    foreground: "#1A2B4A",
    card: "#FFFFFF",
    cardForeground: "#1A2B4A",
    secondary: "#F4E4C1",
    secondaryForeground: "#1A2B4A",
    muted: "#F4E4C1",
    mutedForeground: "#2E4A6F",
    accent: "#D4AF37",
    accentForeground: "#1A2B4A",
    destructive: "#E74C3C",
    destructiveForeground: "#FFFFFF",
    border: "#D4AF37",
    input: "#F4E4C1",
    ring: "#FF9933",
    success: "#1B7A4A",
    warning: "#C47A00",
    info: "#2E4A6F",
    overlay: "rgba(26, 43, 74, 0.55)",
    tabBar: "#1A2B4A",
    tabBarInactive: "#A8B4C8",
    white: "#FFFFFF",
  },
  dark: {
    primary: "#FF7A00",
    primaryForeground: "#FFFFFF",
    navy: "#0B1424",
    gold: "#D4AF37",
    cream: "#F7F1E4",
    terracotta: "#C65D3B",
    background: "#0B1424",
    foreground: "#F7F1E4",
    card: "#152238",
    cardForeground: "#F7F1E4",
    secondary: "#1E2F4A",
    secondaryForeground: "#F7F1E4",
    muted: "#1E2F4A",
    mutedForeground: "#C5D0E0",
    accent: "#D4AF37",
    accentForeground: "#0B1424",
    destructive: "#E74C3C",
    destructiveForeground: "#FFFFFF",
    border: "#D4AF37",
    input: "#1E2F4A",
    ring: "#FF7A00",
    success: "#3DDC97",
    warning: "#F5C451",
    info: "#7AA2D4",
    overlay: "rgba(11, 20, 36, 0.72)",
    tabBar: "#0B1424",
    tabBarInactive: "#7A8799",
    white: "#FFFFFF",
  },
} as const;

export type ThemeName = keyof typeof colors;
export type ColorTokens = { [K in keyof (typeof colors)["light"]]: string };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 40,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700" as const },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0.6 },
  price: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
} as const;

export const TOKEN_KEY = "bseva_token";
export const THEME_KEY = "bseva-theme";
export const LANG_KEY = "bseva-lang";
