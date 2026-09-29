import { radius } from "@bseva/tokens";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CustomerContactPanel } from "@/components/customer/CustomerContactPanel";
import { CustomerSupportPanel } from "@/components/customer/CustomerSupportPanel";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

type SupportContactTab = "support" | "contact";

function SupportContactTabs({
  value,
  onChange,
}: {
  value: SupportContactTab;
  onChange: (next: SupportContactTab) => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const options: { id: SupportContactTab; label: string }[] = [
    { id: "support", label: t("mobile.support") },
    { id: "contact", label: t("mobile.contact") },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        backgroundColor: colors.white,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.id)}
            style={{
              flex: 1,
              minHeight: 44,
              paddingVertical: 8,
              paddingHorizontal: 6,
              backgroundColor: active ? colors.primary : colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText
              numberOfLines={1}
              style={{
                textAlign: "center",
                fontSize: 14,
                lineHeight: 18,
                fontWeight: active ? "700" : "500",
              }}
              color={colors.navy}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SupportContactScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<SupportContactTab>("support");

  useEffect(() => {
    if (params.tab === "contact") setTab("contact");
    else if (params.tab === "support") setTab("support");
  }, [params.tab]);

  return (
    <Screen>
      <ScreenHeader title={t("mobile.supportAndContact")} back />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <SupportContactTabs value={tab} onChange={setTab} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: tab === "support" ? "flex" : "none" }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <CustomerSupportPanel />
          </ScrollView>
        </View>
        <View style={{ flex: 1, display: tab === "contact" ? "flex" : "none" }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <CustomerContactPanel />
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
}
