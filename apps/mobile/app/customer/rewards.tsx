import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, Share } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { rupees } from "@bseva/config";
import { useI18n } from "@/providers/I18nProvider";

export default function RewardsScreen() {
  const { t } = useI18n();
  const codeQ = useQuery({
    queryKey: ["referral"],
    queryFn: () =>
      apiClient.customerReferral() as Promise<{
        code?: string;
        referral_code?: string;
        my_referrals?: { name?: string }[];
      }>,
  });
  const rewardsQ = useQuery({
    queryKey: ["rewards"],
    queryFn: () =>
      apiClient.rewards() as Promise<{
        items?: { id?: string; note?: string; amount_paise?: number }[];
        transactions?: { id?: string; note?: string; amount_paise?: number }[];
      }>,
  });
  const mine = codeQ.data?.code || codeQ.data?.referral_code || "";
  const rows = rewardsQ.data?.items || rewardsQ.data?.transactions || [];
  const referrals = codeQ.data?.my_referrals || [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.rewards")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <AppText variant="small">{t("mobile.referralCode")}</AppText>
          <AppText variant="h2">{mine || "—"}</AppText>
          <PrimaryButton
            title={t("mobile.copyCode")}
            variant="outline"
            onPress={async () => {
              if (!mine) return;
              await Clipboard.setStringAsync(mine);
              Alert.alert(t("mobile.copied"), mine);
            }}
          />
          <PrimaryButton
            title={t("mobile.share")}
            onPress={async () => {
              if (!mine) return;
              await Share.share({ message: t("mobile.referralShare", { code: mine }) });
            }}
          />
        </Card>
        {referrals.map((r, i) => (
          <Card key={i}>
            <AppText>{r.name || t("mobile.reward")}</AppText>
          </Card>
        ))}
        {rows.map((r) => (
          <Card key={r.id}>
            <AppText>{r.note || t("mobile.reward")}</AppText>
            {r.amount_paise != null ? <AppText>{rupees(r.amount_paise)}</AppText> : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
