import {
  enabledSevaServiceTypes,
  resolveSevaServiceType,
  type SevaServiceType,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PujaDiscovery } from "@/components/customer/PujaDiscovery";
import { SevaTypePane } from "@/components/customer/SevaTypePane";
import { SevaTypeTabs } from "@/components/customer/SevaTypeTabs";
import { AppText, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

/**
 * Explore Services: Puja Seva (default) | Chadhava Seva | Pravachan Seva.
 * `?type=` selects a tab (used by the legacy `/customer/seva?type=` deep links).
 */
export default function CustomerServices() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ type?: string }>();
  const [requested, setRequested] = useState<string | undefined>(params.type);

  useEffect(() => {
    if (params.type) setRequested(params.type);
  }, [params.type]);

  const sevaConfig = useQuery({ queryKey: ["seva-config"], queryFn: () => apiClient.getSevaConfig() });
  const enabledTypes = useMemo(() => enabledSevaServiceTypes(sevaConfig.data), [sevaConfig.data]);
  const activeType: SevaServiceType = resolveSevaServiceType(requested, enabledTypes);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <AppText variant="h2" style={{ flex: 1 }}>
            {t("mobile.services")}
          </AppText>
          <Pressable
            onPress={() => router.push("/customer/my-seva")}
            accessibilityRole="button"
            accessibilityLabel={t("seva.mySeva")}
            hitSlop={8}
          >
            <AppText color={colors.primary} style={{ fontWeight: "700" }}>
              {t("seva.mySeva")}
            </AppText>
          </Pressable>
        </View>
        <SevaTypeTabs value={activeType} types={enabledTypes} onChange={setRequested} />
      </SafeAreaView>
      {activeType === "puja" ? <PujaDiscovery /> : <SevaTypePane key={activeType} type={activeType} />}
    </Screen>
  );
}
