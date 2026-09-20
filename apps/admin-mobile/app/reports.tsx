import { buildReportSheetTables, reportWorkbookFilename, rupees, type ReportWorkbookData } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, ScrollView } from "react-native";
import * as XLSX from "xlsx";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { shareBase64File } from "@/utils/files";

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminReports() {
  const { t } = useI18n();
  const [range, setRange] = useState("last_30_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tab, setTab] = useState("overview");
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
    queryFn: () => apiClient.api<ReportWorkbookData>(`/admin/reports?${query}`),
    enabled,
  });
  const data = q.data;
  const ov = data?.overview;

  async function shareExcel() {
    if (!data) {
      Alert.alert("Reports", "Generate a report first");
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      for (const table of buildReportSheetTables(data, (d) => String(d).slice(0, 10))) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(table.rows), table.name);
      }
      const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
      await shareBase64File(b64, reportWorkbookFilename(data), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (e: unknown) {
      Alert.alert("Reports", e instanceof Error ? e.message : "Share failed");
    }
  }

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
        <PrimaryButton title="Share Excel workbook" onPress={() => void shareExcel()} />
        <ChoiceChips
          options={[
            { id: "overview", label: "Overview" },
            { id: "pujaris", label: "Pujari" },
            { id: "customers", label: "Customer" },
            { id: "services", label: "Service" },
            { id: "payments", label: "Payment" },
          ]}
          value={tab}
          onChange={(v) => setTab(String(v))}
        />
        {q.isLoading ? <LoadingBlock /> : null}
        {tab === "overview" && ov ? (
          <>
            <Card>
              <AppText variant="small">Revenue</AppText>
              <AppText variant="h2">{rupees(ov.revenue_paise)}</AppText>
            </Card>
            <Card>
              <AppText variant="small">Bookings</AppText>
              <AppText variant="h2">{ov.bookings}</AppText>
              <AppText variant="small">Completed {ov.completed} · Confirmed {ov.confirmed} · Cancelled {ov.cancelled}</AppText>
            </Card>
            {(ov.trend || []).slice(-14).map((d) => (
              <AppText key={d.date} variant="small">{d.date}: {d.total} bookings</AppText>
            ))}
          </>
        ) : null}
        {tab === "pujaris" && data ? data.pujaris.map((r) => (
          <Card key={r.id}>
            <AppText variant="h3">{r.name}</AppText>
            <AppText variant="small">{r.bookings} bookings · {rupees(r.earnings)} · {r.availability_status}</AppText>
          </Card>
        )) : null}
        {tab === "customers" && data ? (
          <Card>
            <AppText>Total {data.customers.total_customers}</AppText>
            <AppText>New {data.customers.new_registrations}</AppText>
            <AppText>Repeat {data.customers.repeat_rate}%</AppText>
          </Card>
        ) : null}
        {tab === "services" && data ? data.services.map((s) => (
          <Card key={s.id}>
            <AppText variant="h3">{s.name}</AppText>
            <AppText variant="small">{s.bookings} · {rupees(s.revenue)}</AppText>
          </Card>
        )) : null}
        {tab === "payments" && data ? (
          <Card>
            <AppText>GMV {rupees(data.payments.gmv)}</AppText>
            <AppText>Platform {rupees(data.payments.commissions)}</AppText>
            <AppText>Payouts {rupees(data.payments.priest_payouts)}</AppText>
            <AppText>Pending {rupees(data.payments.pending_settlements)}</AppText>
            <AppText>Refunds {rupees(data.payments.refunds)}</AppText>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
