import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

type RewardRow = {
  id?: string;
  reward_type?: string;
  status?: string;
  amount_paise?: number;
  created_at?: string;
};

export default function PujariRewards() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["wallet-rewards"],
    queryFn: () => apiClient.rewards() as Promise<RewardRow[]>,
  });
  const rows = Array.isArray(q.data) ? q.data : [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.rewards")} back />
      {q.isLoading ? <LoadingBlock /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <AppText variant="small">{t("rewards.history")}</AppText>
        {!q.isLoading && rows.length === 0 ? <AppText>{t("rewards.empty")}</AppText> : null}
        {rows.map((row, index) => {
          const status = String(row.status || "");
          const statusLabel = status ? t(`status.${status}`) : "";
          return (
            <Card key={row.id || String(index)}>
              <AppText variant="h3">{rupees(Number(row.amount_paise || 0))}</AppText>
              <AppText variant="small">
                {[row.reward_type, statusLabel && !statusLabel.startsWith("status.") ? statusLabel : status]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
