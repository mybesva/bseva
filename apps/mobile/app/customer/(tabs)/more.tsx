import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Screen } from "@/components/ui";
import { requestAppPermissions } from "@/utils/permissions";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

const ITEMS = [
  { href: "/customer/profile", label: "Profile", icon: "person" as const },
  { href: "/customer/address", label: "Address", icon: "location" as const },
  { href: "/customer/invoices", label: "Invoices", icon: "document-text" as const },
  { href: "/customer/rewards", label: "Rewards", icon: "gift" as const },
  { href: "/customer/history", label: "History", icon: "time" as const },
  { href: "/customer/astrology", label: "Astrology", icon: "planet" as const },
  { href: "/customer/support", label: "Support", icon: "help-circle" as const },
  { href: "/customer/password", label: "Change password", icon: "lock-closed" as const },
];

export default function CustomerMore() {
  const { colors, toggleTheme, theme } = useAppTheme();
  const { logout } = useAuth();
  const { lang, setLang, labels } = useI18n();
  const router = useRouter();
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">More</AppText>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}
          >
            <Ionicons name={item.icon} size={20} color={colors.primary} />
            <AppText style={{ flex: 1 }}>{item.label}</AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
        <View style={{ height: 12 }} />
        <AppText variant="small">Language</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
          {(["en", "hi", "te"] as const).map((code) => (
            <Pressable
              key={code}
              onPress={() => setLang(code)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: lang === code ? colors.primary : colors.secondary,
              }}
            >
              <AppText variant="small" color={lang === code ? colors.primaryForeground : colors.foreground}>
                {labels[code]}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={async () => {
            const status = await requestAppPermissions();
            Alert.alert("Permissions", status);
          }}
          style={{ paddingVertical: 14 }}
        >
          <AppText>Enable location, photos & notifications</AppText>
        </Pressable>
        <Pressable onPress={toggleTheme} style={{ paddingVertical: 14 }}>
          <AppText>Theme: {theme === "dark" ? "Dark" : "Light"}</AppText>
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
          style={{ paddingVertical: 14 }}
        >
          <AppText color={colors.destructive}>Log out</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
