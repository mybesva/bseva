import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Inv = { id: string; invoice_number?: string; type?: string; booking_id?: string; created_at?: string };

export default function AdminInvoices() {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
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
        {rows.map((inv) => (
          <Card key={inv.id}>
            <AppText variant="h3">{inv.invoice_number || inv.id}</AppText>
            <AppText variant="small">{inv.type} · {inv.created_at}</AppText>
            <PrimaryButton title="View invoice" onPress={() => router.push(`/invoice/${inv.id}`)} />
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
