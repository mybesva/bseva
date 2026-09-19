import { Linking, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function ContactScreen() {
  const { t } = useI18n();
  const config = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const data = config.data || {};
  const phone = String(data.bseva_whatsapp_number || data.support_phone || "");
  const email = String(data.email_from_support || data.support_email || "");
  const digits = phone.replace(/[^\d+]/g, "");
  return (
    <Screen>
      <ScreenHeader title={t("mobile.contact")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {config.isLoading ? <LoadingBlock /> : null}
        <Card style={{ gap: 10 }}>
          {phone ? (
            <>
              <AppText variant="small">{t("nav.contact")}</AppText>
              <AppText variant="h3">{phone}</AppText>
              <PrimaryButton title={phone} onPress={() => void Linking.openURL(`tel:${digits}`)} />
              <PrimaryButton title={t("mobile.whatsapp")} variant="outline" onPress={() => void Linking.openURL(`https://wa.me/${digits.replace(/^\+/, "")}`)} />
            </>
          ) : null}
          {email ? (
            <>
              <AppText variant="small">{email}</AppText>
              <PrimaryButton title={email} variant="outline" onPress={() => void Linking.openURL(`mailto:${email}`)} />
            </>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
