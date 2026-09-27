import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, Share } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { rupees } from "@bseva/config";
import { useI18n } from "@/providers/I18nProvider";

type ReferralRow = { name?: string; status?: string };
type RewardRow = {
  id?: string;
  reward_type?: string;
  status?: string;
  amount_paise?: number;
  created_at?: string;
};

export default function CustomerReferral() {
  const { t } = useI18n();
  const referralQ = useQuery({
    queryKey: ["customer-referral"],
    queryFn: () =>
      apiClient.customerReferral() as Promise<{
        referral_code?: string;
        code?: string;
        my_referrals?: ReferralRow[];
      }>,
  });
  const rewardsQ = useQuery({
    queryKey: ["wallet-rewards"],
    queryFn: () => apiClient.rewards() as Promise<RewardRow[]>,
  });

  const code = referralQ.data?.referral_code || referralQ.data?.code || "";
  const referrals = referralQ.data?.my_referrals || [];
  const rewards = Array.isArray(rewardsQ.data) ? rewardsQ.data : [];
  const loading = referralQ.isLoading || rewardsQ.isLoading;

  return (
    <Screen>
      <ScreenHeader title={t("nav.referral")} back />
      {loading ? <LoadingBlock /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <AppText>{t("web.referral.description")}</AppText>

        <Card>
          <AppText variant="small">{t("rewards.yourCode")}</AppText>
          <AppText variant="h1">{code || "—"}</AppText>
          <PrimaryButton
            title={t("rewards.copy")}
            variant="outline"
            onPress={async () => {
              if (!code) return;
              await Clipboard.setStringAsync(code);
              Alert.alert(t("rewards.copied"), code);
            }}
          />
          <PrimaryButton
            title={t("rewards.share")}
            onPress={async () => {
              if (!code) return;
              await Share.share({ message: t("mobile.referralShare", { code }) });
            }}
          />
          <AppText variant="small">{t("rewards.shareHint")}</AppText>
        </Card>

        <AppText variant="h3">{t("web.referral.myReferrals")}</AppText>
        {!loading && referrals.length === 0 ? <AppText>{t("web.referral.empty")}</AppText> : null}
        {referrals.map((row, index) => (
          <Card key={`${row.name || "ref"}-${index}`}>
            <AppText>{row.name || "—"}</AppText>
          </Card>
        ))}

        <AppText variant="h3">{t("rewards.history")}</AppText>
        {!loading && rewards.length === 0 ? <AppText>{t("rewards.empty")}</AppText> : null}
        {rewards.map((row, index) => {
          const status = String(row.status || "");
          const statusLabel = status ? t(`status.${status}`) : "";
          const shown = statusLabel && !statusLabel.startsWith("status.") ? statusLabel : status;
          return (
            <Card key={row.id || String(index)}>
              <AppText variant="h3">{rupees(Number(row.amount_paise || 0))}</AppText>
              <AppText variant="small">
                {[row.reward_type, shown].filter(Boolean).join(" · ")}
              </AppText>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
