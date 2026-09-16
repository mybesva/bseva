import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function AdminSettings() {
  const { t } = useI18n();
  const [gst, setGst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pricing = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const p = await apiClient.api<{ gst_percent?: number }>("/admin/pricing");
      setGst(String(p.gst_percent ?? ""));
      return p;
    },
  });
  const config = useQuery({
    queryKey: ["admin-config"],
    queryFn: () => apiClient.api<Record<string, unknown>>("/admin/config"),
  });
  return (
    <Screen>
      <ScreenHeader title={t("admin.settings")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {pricing.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="h3">GST %</AppText>
          <Field label="GST percent" value={gst} onChangeText={setGst} keyboardType="decimal-pad" />
          <PrimaryButton
            title={t("admin.save")}
            onPress={async () => {
              setError(null);
              try {
                await apiClient.api("/admin/pricing", { method: "PUT", body: JSON.stringify({ gst_percent: Number(gst) }) });
                await pricing.refetch();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
        </Card>
        <AppText variant="h3">Platform keys</AppText>
        {Object.entries(config.data || {}).slice(0, 40).map(([k, v]) => (
          <Card key={k}>
            <AppText variant="small">{k}</AppText>
            <AppText>{typeof v === "object" ? JSON.stringify(v) : String(v)}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
