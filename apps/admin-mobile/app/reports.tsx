import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, LoadingBlock, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

function display(key: string, value: unknown) {
  if (value == null) return "—";
  if (typeof value === "number" && /paise|amount|revenue|total/i.test(key)) return rupees(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AdminReports() {
  const { t } = useI18n();
  const [range, setRange] = useState("last_30_days");
  const q = useQuery({
    queryKey: ["admin-reports", range],
    queryFn: () => apiClient.api<Record<string, unknown>>(`/admin/reports?range=${range}`),
  });
  const data = q.data || {};
  return (
    <Screen>
      <ScreenHeader title={t("admin.reports")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ChoiceChips
          options={[
            { id: "today", label: "Today" },
            { id: "last_7_days", label: "7 days" },
            { id: "last_30_days", label: "30 days" },
            { id: "last_90_days", label: "90 days" },
            { id: "this_year", label: "Year" },
          ]}
          value={range}
          onChange={(v) => setRange(String(v))}
        />
        {q.isLoading ? <LoadingBlock /> : null}
        {Object.entries(data).map(([k, v]) => (
          <Card key={k}>
            <AppText variant="small">{k}</AppText>
            <AppText variant="h3">{display(k, v)}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
