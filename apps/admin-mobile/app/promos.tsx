import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Banner = { id: string; title?: string; subtitle?: string; active?: boolean };

export default function AdminPromos() {
  const { t } = useI18n();
  const banners = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => apiClient.api<Banner[] | { items?: Banner[] }>("/admin/promos/banners"),
  });
  const popups = useQuery({
    queryKey: ["admin-popups"],
    queryFn: () => apiClient.api<Banner[] | { items?: Banner[] }>("/admin/promos/popups"),
  });
  const bannerRows = Array.isArray(banners.data) ? banners.data : banners.data?.items || [];
  const popupRows = Array.isArray(popups.data) ? popups.data : popups.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.promos")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <AppText variant="h3">Banners</AppText>
        {banners.isLoading ? <LoadingBlock /> : null}
        {bannerRows.map((b) => (
          <Card key={b.id}>
            <AppText variant="h3">{b.title}</AppText>
            <AppText variant="small">{b.subtitle} · {b.active ? "active" : "off"}</AppText>
            <PrimaryButton
              title={b.active ? "Unpublish" : "Publish"}
              variant="outline"
              onPress={() => void apiClient.api(`/admin/promos/banners/${b.id}`, { method: "PATCH", body: JSON.stringify({ active: !b.active }) }).then(() => banners.refetch())}
            />
            <PrimaryButton
              title="Delete"
              variant="ghost"
              onPress={() =>
                Alert.alert("Delete banner?", b.title || b.id, [
                  { text: "Cancel" },
                  { text: "Delete", style: "destructive", onPress: () => void apiClient.api(`/admin/promos/banners/${b.id}`, { method: "DELETE" }).then(() => banners.refetch()) },
                ])
              }
            />
          </Card>
        ))}
        <AppText variant="h3">Popups</AppText>
        {popupRows.map((b) => (
          <Card key={b.id}>
            <AppText variant="h3">{b.title}</AppText>
            <AppText variant="small">{b.active ? "active" : "off"}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
