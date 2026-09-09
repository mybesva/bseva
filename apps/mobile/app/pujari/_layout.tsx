import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { RoleGate } from "@/components/RoleGate";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PujariLayout() {
  const { colors } = useAppTheme();
  return (
    <RoleGate allow="pujari">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.gold },
          tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
        <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" color={color} size={size} /> }} />
        <Tabs.Screen name="earnings" options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Ionicons name="cash" color={color} size={size} /> }} />
        <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color, size }) => <Ionicons name="menu" color={color} size={size} /> }} />
        <Tabs.Screen name="booking/[id]" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="angikara" options={{ href: null }} />
        <Tabs.Screen name="availability" options={{ href: null }} />
        <Tabs.Screen name="services" options={{ href: null }} />
        <Tabs.Screen name="experience" options={{ href: null }} />
        <Tabs.Screen name="address" options={{ href: null }} />
        <Tabs.Screen name="bank" options={{ href: null }} />
        <Tabs.Screen name="referral" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="password" options={{ href: null }} />
        <Tabs.Screen name="ratings" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  );
}
