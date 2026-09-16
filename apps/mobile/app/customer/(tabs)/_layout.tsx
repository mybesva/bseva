import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerTabs() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.gold },
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("mobile.home"), tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="services"
        options={{ title: t("nav.services"), tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: t("nav.bookings"), tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ title: t("nav.wallet"), tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: t("mobile.more"), tabBarIcon: ({ color, size }) => <Ionicons name="menu" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
