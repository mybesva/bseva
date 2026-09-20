import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function display(key: string, value: unknown) {
  if (value == null) return "—";
  if (typeof value === "number" && /paise|amount|revenue|total/i.test(key)) return rupees(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AdminReports() {
  const { t } = useI18n();
  const [range, setRange] = useState("last_30_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const query = useMemo(() => {
    const qs = new URLSearchParams({ range });
    if (range === "custom" && customFrom && customTo) {
      qs.set("from", customFrom);
      qs.set("to", customTo);
    }
    return qs.toString();
  }, [range, customFrom, customTo]);
  const enabled = range !== "custom" || Boolean(customFrom && customTo);
  const q = useQuery({
    queryKey: ["admin-reports", query],
    queryFn: () => apiClient.api<Record<string, unknown>>(`/admin/reports?${query}`),
    enabled,
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
            { id: "custom", label: "Custom" },
          ]}
          value={range}
          onChange={(v) => {
            const next = String(v);
            if (next === "custom" && (!customFrom || !customTo)) {
              const to = new Date();
              const from = new Date();
              from.setDate(from.getDate() - 29);
              setCustomFrom(isoDate(from));
              setCustomTo(isoDate(to));
            }
            setRange(next);
          }}
        />
        {range === "custom" ? (
          <>
            <Field label="From (YYYY-MM-DD)" value={customFrom} onChangeText={setCustomFrom} />
            <Field label="To (YYYY-MM-DD)" value={customTo} onChangeText={setCustomTo} />
            <PrimaryButton title="Generate" variant="outline" onPress={() => void q.refetch()} />
          </>
        ) : null}
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
