import { PUJARI_DOC_TYPES } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { MediaPicker } from "@/components/MediaPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function PujariDocuments() {
  const { t } = useI18n();
  const router = useRouter();
  const q = useQuery({ queryKey: ["pujari-docs"], queryFn: () => apiClient.pujariDocuments() });
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const official = useQuery({ queryKey: ["official-docs"], queryFn: () => apiClient.officialDocuments() as Promise<{ items?: { title?: string; status?: string }[] } | unknown[]> });
  const [docType, setDocType] = useState("identity");
  const [error, setError] = useState<string | null>(null);
  const licenceOn = String(profile.data?.licence_type || "").toLowerCase() === "driving_licence" || String(profile.data?.licence_type || "").toLowerCase() === "cab_commercial";
  const docOptions = PUJARI_DOC_TYPES.filter((d) => d.id !== "driving_licence" || licenceOn);
  const officialRows = Array.isArray(official.data) ? official.data : official.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.documents")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText>{t("mobile.documentsHelp")}</AppText>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText>Driving licence</AppText>
          <Switch
            value={licenceOn}
            onValueChange={(on) => {
              void apiClient.patchPujariProfile({ licence_type: on ? "driving_licence" : "none" }).then(() => profile.refetch());
            }}
          />
        </View>
        <ChoiceChips options={docOptions.map((t) => ({ id: t.id, label: t.label }))} value={docType} onChange={(v) => setDocType(String(v))} />
        <MediaPicker
          allowFile
          onPicked={async (file) => {
            setError(null);
            try {
              await apiClient.uploadPujariDocument(file, docType);
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.uploadFailed"));
            }
          }}
        />
        {(q.data || []).map((d) => (
          <Card key={d.id}>
            <AppText variant="h3">{d.document_type}</AppText>
            {d.status ? <StatusBadge status={String(d.status)} /> : null}
          </Card>
        ))}
        {officialRows.length > 0 ? <AppText variant="h3">{t("mobile.officialDocuments")}</AppText> : null}
        {officialRows.map((d, i) => (
          <Card key={i}>
            <AppText>{String((d as { title?: string; document_type?: string }).title || (d as { document_type?: string }).document_type || t("mobile.document"))}</AppText>
            {(d as { status?: string }).status ? <StatusBadge status={String((d as { status?: string }).status)} /> : null}
          </Card>
        ))}
        <PrimaryButton title={t("mobile.goAngikara")} variant="outline" onPress={() => router.push("/pujari/angikara")} />
      </ScrollView>
    </Screen>
  );
}
