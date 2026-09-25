import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, Share } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function PujariReferral() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["pujari-referral"],
    queryFn: () =>
      apiClient.pujariReferral() as Promise<{
        code?: string;
        referral_code?: string;
        my_referrals?: { name?: string; status?: string }[];
      }>,
  });
  const code = q.data?.code || q.data?.referral_code || "";
  const referrals = q.data?.my_referrals || [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.referral")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <AppText>{t("web.referral.description")}</AppText>
        <Card>
          <AppText variant="small">{t("mobile.referralCode")}</AppText>
          <AppText variant="h1">{code || "—"}</AppText>
          <AppText variant="small">{t("web.referral.rewardHint")}</AppText>
          <PrimaryButton
            title={t("mobile.copy")}
            variant="outline"
            onPress={async () => {
              if (!code) return;
              await Clipboard.setStringAsync(code);
              Alert.alert(t("mobile.copied"), code);
            }}
          />
          <PrimaryButton
            title={t("mobile.share")}
            onPress={async () => {
              if (!code) return;
              await Share.share({ message: t("mobile.referralShare", { code }) });
            }}
          />
        </Card>
        <AppText variant="h3">{t("web.referral.myReferrals")}</AppText>
        {referrals.length === 0 ? <AppText>{t("web.referral.empty")}</AppText> : null}
        {referrals.map((r, i) => {
          const status = String(r.status || "");
          const statusLabel = status ? t(`status.${status}`) : "";
          const shown = statusLabel && !statusLabel.startsWith("status.") ? statusLabel : status;
          return (
            <Card key={i}>
              <AppText>{r.name || "—"}</AppText>
              {shown ? <AppText variant="small">{shown}</AppText> : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
