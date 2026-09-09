import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

const ITEMS = [
  { href: "/pujari/onboarding", label: "Onboarding", icon: "flag" as const },
  { href: "/pujari/profile", label: "Profile", icon: "person" as const },
  { href: "/pujari/documents", label: "Documents", icon: "document" as const },
  { href: "/pujari/angikara", label: "Angikara", icon: "ribbon" as const },
  { href: "/pujari/availability", label: "Availability", icon: "calendar" as const },
  { href: "/pujari/services", label: "Services / level", icon: "layers" as const },
  { href: "/pujari/experience", label: "Experience", icon: "school" as const },
  { href: "/pujari/address", label: "Address", icon: "location" as const },
  { href: "/pujari/bank", label: "Bank", icon: "card" as const },
  { href: "/pujari/referral", label: "Referral", icon: "gift" as const },
  { href: "/pujari/ratings", label: "Head ratings", icon: "star" as const },
  { href: "/pujari/support", label: "Support", icon: "help-circle" as const },
  { href: "/pujari/password", label: "Change password", icon: "lock-closed" as const },
];

export default function PujariMore() {
  const { colors, toggleTheme, theme } = useAppTheme();
  const { logout, user } = useAuth();
  const { lang, setLang, labels } = useI18n();
  const router = useRouter();
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">More</AppText>
        <AppText variant="small">{user?.name}</AppText>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
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
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
          {(["en", "hi", "te"] as const).map((code) => (
            <Pressable key={code} onPress={() => setLang(code)} style={{ padding: 8, borderRadius: 8, backgroundColor: lang === code ? colors.primary : colors.secondary }}>
              <AppText variant="small">{labels[code]}</AppText>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={toggleTheme} style={{ paddingVertical: 12 }}>
          <AppText>Theme: {theme}</AppText>
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
        >
          <AppText color={colors.destructive}>Log out</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
