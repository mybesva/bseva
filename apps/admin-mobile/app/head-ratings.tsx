import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function HeadRatings() {
  const { t } = useI18n();
  const [pujariId, setPujariId] = useState("");
  const [stars, setStars] = useState("5");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const history = useQuery({ queryKey: ["head-ratings"], queryFn: () => apiClient.headRatings() });
  const pujaris = useQuery({ queryKey: ["head-pujaris"], queryFn: () => apiClient.api<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>("/head/pujaris") });
  const rows = Array.isArray(history.data) ? history.data : (history.data as { items?: Record<string, unknown>[] } | undefined)?.items || [];
  const people = Array.isArray(pujaris.data) ? pujaris.data : (pujaris.data as { items?: Record<string, unknown>[] } | undefined)?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.headRatings")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {people.slice(0, 20).map((p) => (
          <PrimaryButton key={String(p.id)} title={String(p.name || p.email || p.id)} variant={pujariId === p.id ? "primary" : "outline"} onPress={() => setPujariId(String(p.id))} />
        ))}
        <Field label="Pujari id" value={pujariId} onChangeText={setPujariId} />
        <ChoiceChips options={["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))} value={stars} onChange={(v) => setStars(String(v))} />
        <Field label="Comments" value={comments} onChangeText={setComments} />
        <PrimaryButton
          title="Submit rating"
          onPress={async () => {
            setError(null);
            try {
              await apiClient.submitHeadRating({ pujari_id: pujariId, stars: Number(stars), comments });
              await history.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
        {history.isLoading ? <LoadingBlock /> : null}
        {rows.map((r, i) => (
          <Card key={String(r.id || i)}>
            <AppText>{String(r.pujari_name || r.pujari_id || "Pujari")} · {String(r.stars || "")}★</AppText>
            <AppText variant="small">{String(r.comments || "")}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
