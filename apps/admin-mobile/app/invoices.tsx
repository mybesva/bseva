import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Inv = { id: string; invoice_number?: string; type?: string; booking_id?: string; created_at?: string };

export default function AdminInvoices() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<{ id: string; body: string } | null>(null);
  const list = useQuery({
    queryKey: ["admin-invoices", q],
    queryFn: () => apiClient.api<{ items?: Inv[] } | Inv[]>(`/admin/invoices?invoice_type=all${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.invoices")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        {list.isLoading ? <LoadingBlock /> : null}
        {html ? (
          <Card>
            <AppText variant="h3">Invoice HTML</AppText>
            <AppText variant="small">{html.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)}</AppText>
            <PrimaryButton title="Close" variant="outline" onPress={() => setHtml(null)} />
          </Card>
        ) : null}
        {rows.map((inv) => (
          <Card key={inv.id}>
            <AppText variant="h3">{inv.invoice_number || inv.id}</AppText>
            <AppText variant="small">{inv.type} · {inv.created_at}</AppText>
            <PrimaryButton
              title="View HTML"
              variant="outline"
              onPress={async () => {
                setError(null);
                try {
                  const body = await apiClient.invoiceHtml(inv.id);
                  setHtml({ id: inv.id, body });
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
            <PrimaryButton
              title="Resend email"
              variant="outline"
              onPress={async () => {
                setError(null);
                try {
                  await apiClient.api(`/invoices/${inv.id}/resend`, { method: "POST" });
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
