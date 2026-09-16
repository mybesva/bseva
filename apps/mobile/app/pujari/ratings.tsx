import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function HeadRatings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const allowed = user?.role === "head_pujari" || user?.role === "admin" || user?.role === "super_admin";
  const q = useQuery({
    queryKey: ["head-ratings"],
    queryFn: () => apiClient.headRatings() as Promise<{ id?: string; pujari_id?: string; stars?: number; comments?: string; created_at?: string }[]>,
    enabled: allowed,
  });
  const [pujariId, setPujariId] = useState("");
  const [stars, setStars] = useState("5");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!allowed) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.headRatings")} back />
        <AppText style={{ padding: 16 }}>{t("mobile.headOnly")}</AppText>
      </Screen>
    );
  }
  const rows = Array.isArray(q.data) ? q.data : [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.assessPujaris")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("mobile.pujariUserId")} value={pujariId} onChangeText={setPujariId} autoCapitalize="none" />
        <AppText variant="small">{t("mobile.stars")}</AppText>
        <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
        <Field label={t("mobile.comments")} value={comments} onChangeText={setComments} />
        <PrimaryButton
          title={t("mobile.submitRating")}
          onPress={async () => {
            setError(null);
            try {
              await apiClient.submitHeadRating({ pujari_id: pujariId.trim(), stars: Number(stars), comments });
              setComments("");
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            }
          }}
        />
        {rows.length === 0 ? <EmptyState title={t("mobile.noRatings")} /> : null}
        {rows.map((row, i) => (
          <Card key={row.id || i}>
            <AppText>{t("mobile.pujariValue", { id: row.pujari_id || "" })}</AppText>
            <AppText>{t("mobile.starCount", { count: row.stars || 0 })}</AppText>
            <AppText variant="small">{row.comments}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
