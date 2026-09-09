import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { RoleGate } from "@/components/RoleGate";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerLayout() {
  const { colors } = useAppTheme();
  return (
    <RoleGate allow="customer">
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
          options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="services"
          options={{ title: "Services", tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="bookings"
          options={{ title: "Bookings", tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="wallet"
          options={{ title: "Wallet", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="more"
          options={{ title: "More", tabBarIcon: ({ color, size }) => <Ionicons name="menu" color={color} size={size} /> }}
        />
        <Tabs.Screen name="book/[slug]" options={{ href: null }} />
        <Tabs.Screen name="booking/[id]" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="address" options={{ href: null }} />
        <Tabs.Screen name="invoices" options={{ href: null }} />
        <Tabs.Screen name="rewards" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="history" options={{ href: null }} />
        <Tabs.Screen name="password" options={{ href: null }} />
        <Tabs.Screen name="astrology" options={{ href: null }} />
        <Tabs.Screen name="invoice/[id]" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  );
}
