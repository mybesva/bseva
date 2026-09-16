import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Svc = { id: string; name: string; slug?: string; standard_price_paise?: number; available?: boolean; bookable?: boolean };

export default function AdminServices() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiClient.api<Svc[] | { items?: Svc[] }>("/admin/services"),
  });
  const rows = (Array.isArray(list.data) ? list.data : list.data?.items || []).filter((s) =>
    !q.trim() ? true : s.name.toLowerCase().includes(q.trim().toLowerCase())
  );
  return (
    <Screen>
      <ScreenHeader title={t("admin.services")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((s) => (
          <Card key={s.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="h3" style={{ flex: 1 }}>{s.name}</AppText>
              <Switch
                value={s.available !== false && s.bookable !== false}
                onValueChange={async (v) => {
                  setError(null);
                  try {
                    await apiClient.api(`/admin/services/${s.id}/availability`, { method: "PATCH", body: JSON.stringify({ available: v }) });
                    await list.refetch();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Failed");
                  }
                }}
              />
            </View>
            <AppText variant="small">{s.slug} · {rupees(s.standard_price_paise)}</AppText>
          </Card>
        ))}
        <PrimaryButton title="Reload" variant="outline" onPress={() => void list.refetch()} />
      </ScrollView>
    </Screen>
  );
}
