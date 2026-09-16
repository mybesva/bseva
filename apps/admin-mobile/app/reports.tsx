import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, LoadingBlock, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

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
        <Card>
          <AppText>Bookings: {String(data.bookings_count ?? data.totalBookings ?? "—")}</AppText>
          <AppText>Revenue: {data.revenue_paise != null ? rupees(Number(data.revenue_paise)) : String(data.revenue ?? "—")}</AppText>
          <AppText>Customers: {String(data.customers_count ?? data.newCustomers ?? "—")}</AppText>
          <AppText>Pujaris: {String(data.pujaris_count ?? "—")}</AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}
