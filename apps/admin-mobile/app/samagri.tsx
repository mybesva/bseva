import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Item = { id: string; name: string; unit?: string; item_key?: string; active?: boolean };

export default function AdminSamagri() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["samagri"],
    queryFn: () => apiClient.api<Item[] | { items?: Item[] }>("/samagri/items"),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.samagri")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((item) => (
          <Card key={item.id}>
            <AppText variant="h3">{item.name}</AppText>
            <AppText variant="small">{item.unit} · {item.item_key}</AppText>
          </Card>
        ))}
        <Card>
          <AppText variant="h3">Add item</AppText>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Unit" value={unit} onChangeText={setUnit} />
          <PrimaryButton
            title="Create"
            onPress={async () => {
              setError(null);
              try {
                await apiClient.api("/admin/samagri/items", { method: "POST", body: JSON.stringify({ name, unit, active: true }) });
                setName("");
                await list.refetch();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
