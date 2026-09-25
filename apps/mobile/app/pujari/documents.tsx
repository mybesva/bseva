import { PUJARI_DOC_TYPES } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, ScrollView, Switch, View } from "react-native";
import { MediaPicker, type PickedMedia } from "@/components/MediaPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function PujariDocuments() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["pujari-docs"], queryFn: () => apiClient.pujariDocuments() });
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const official = useQuery({ queryKey: ["official-docs"], queryFn: () => apiClient.officialDocuments() as Promise<{ items?: { title?: string; status?: string }[] } | unknown[]> });
  const [docType, setDocType] = useState("identity");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState<PickedMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const licenceOn = String(profile.data?.licence_type || "").toLowerCase() === "driving_licence" || String(profile.data?.licence_type || "").toLowerCase() === "cab_commercial";
  const docOptions = PUJARI_DOC_TYPES.filter((d) => d.id !== "driving_licence" || licenceOn);
  const officialRows = Array.isArray(official.data) ? official.data : official.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.documents")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {saved ? <AppText>{saved}</AppText> : null}
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
          onPicked={(file) => {
            setError(null);
            setSaved(null);
            setPending(file);
          }}
        />
        {pending ? (
          <Card>
            {pending.type.startsWith("image/") ? (
              <Image source={{ uri: pending.uri }} style={{ width: "100%", height: 180, borderRadius: 8 }} resizeMode="cover" />
            ) : (
              <AppText>{pending.name}</AppText>
            )}
            <PrimaryButton title={t("common.cancel")} variant="outline" onPress={() => setPending(null)} />
            <PrimaryButton
              title={t("mobile.uploadPhoto")}
              loading={uploading}
              onPress={() => {
                const file = pending;
                if (!file) return;
                setUploading(true);
                setError(null);
                void apiClient
                  .uploadPujariDocument(file, docType)
                  .then(() => q.refetch())
                  .then(() => {
                    setPending(null);
                    setSaved(t("common.saved"));
                  })
                  .catch((e: unknown) => {
                    setError(e instanceof Error ? e.message : t("mobile.uploadFailed"));
                  })
                  .finally(() => setUploading(false));
              }}
            />
          </Card>
        ) : null}
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
      </ScrollView>
    </Screen>
  );
}
