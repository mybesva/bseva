import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function AdminPricing() {
  const { t } = useI18n();
  const [city, setCity] = useState("");
  const [adj, setAdj] = useState("0");
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const loc = useQuery({ queryKey: ["location-prices"], queryFn: () => apiClient.api<Record<string, unknown>[]>("/admin/location-prices") });
  const surge = useQuery({ queryKey: ["surge-rules"], queryFn: () => apiClient.api<Record<string, unknown>[]>("/admin/surge-rules") });
  return (
    <Screen>
      <ScreenHeader title={t("admin.pricing")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText variant="h3">City adjustments</AppText>
        {loc.isLoading ? <LoadingBlock /> : null}
        {(Array.isArray(loc.data) ? loc.data : []).map((r) => (
          <Card key={String(r.id || r.city)}>
            <AppText>{String(r.city)} · {rupees(Number(r.adjustment_paise || 0))}</AppText>
          </Card>
        ))}
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="Adjustment (rupees)" value={adj} onChangeText={setAdj} keyboardType="decimal-pad" />
        <PrimaryButton
          title="Add city price"
          onPress={async () => {
            setError(null);
            try {
              await apiClient.api("/admin/location-prices", { method: "POST", body: JSON.stringify({ city, adjustment_paise: Math.round(Number(adj) * 100), active: true }) });
              await loc.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
        <AppText variant="h3">Surge rules</AppText>
        {(Array.isArray(surge.data) ? surge.data : []).map((r) => (
          <Card key={String(r.id || r.label)}>
            <AppText>{String(r.label)} · {String(r.percent_increase || 0)}%</AppText>
          </Card>
        ))}
        <Field label="Label" value={label} onChangeText={setLabel} />
        <Field label="Percent" value={percent} onChangeText={setPercent} keyboardType="decimal-pad" />
        <PrimaryButton
          title="Add surge rule"
          variant="outline"
          onPress={async () => {
            setError(null);
            try {
              await apiClient.api("/admin/surge-rules", { method: "POST", body: JSON.stringify({ label, percent_increase: Number(percent), active: true, priority: 1 }) });
              await surge.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
