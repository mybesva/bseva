import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Rec = { id: string; title?: string; description?: string; service_id?: string; active?: boolean };

export default function AdminRecommendations() {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-recs"],
    queryFn: () => apiClient.api<Rec[] | { items?: Rec[] }>("/admin/recommendations"),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.recommendations")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((r) => (
          <Card key={r.id}>
            <AppText variant="h3">{r.title}</AppText>
            <AppText variant="small">{r.description}</AppText>
            <PrimaryButton
              title="Delete"
              variant="outline"
              onPress={() =>
                Alert.alert("Delete?", r.title || r.id, [
                  { text: "Cancel" },
                  { text: "Delete", style: "destructive", onPress: () => void apiClient.api(`/admin/recommendations/${r.id}`, { method: "DELETE" }).then(() => list.refetch()) },
                ])
              }
            />
          </Card>
        ))}
        <Card>
          <AppText variant="h3">Add</AppText>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <Field label="Service id" value={serviceId} onChangeText={setServiceId} />
          <PrimaryButton
            title="Create"
            onPress={async () => {
              setError(null);
              try {
                await apiClient.api("/admin/recommendations", { method: "POST", body: JSON.stringify({ title, service_id: serviceId, active: true }) });
                setTitle(""); setServiceId("");
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
