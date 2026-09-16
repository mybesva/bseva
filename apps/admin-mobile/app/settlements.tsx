import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Row = { id: string; pujari_name?: string; status?: string; amount_paise?: number; pujari_payable_paise?: number };

export default function AdminSettlements() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["settlements", q],
    queryFn: () => apiClient.api<{ items?: Row[] } | Row[]>(`/settlements?page=1&limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.settlements")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((s) => (
          <Card key={s.id}>
            <StatusBadge status={String(s.status || "pending")} />
            <AppText variant="h3">{s.pujari_name || s.id}</AppText>
            <AppText>{rupees(s.pujari_payable_paise ?? s.amount_paise)}</AppText>
            <Field label="Override reason" value={reason} onChangeText={setReason} />
            <PrimaryButton
              title="Mark settled"
              variant="outline"
              onPress={async () => {
                setError(null);
                try {
                  await apiClient.api(`/settlements/${s.id}/override`, { method: "POST", body: JSON.stringify({ reason, mark_settled: true }) });
                  await list.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
