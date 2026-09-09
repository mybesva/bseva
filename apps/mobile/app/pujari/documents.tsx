import { PUJARI_DOC_TYPES } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { MediaPicker } from "@/components/MediaPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function PujariDocuments() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["pujari-docs"], queryFn: () => apiClient.pujariDocuments() });
  const official = useQuery({ queryKey: ["official-docs"], queryFn: () => apiClient.officialDocuments() as Promise<{ items?: { title?: string; status?: string }[] } | unknown[]> });
  const [docType, setDocType] = useState("identity");
  const [error, setError] = useState<string | null>(null);
  const officialRows = Array.isArray(official.data) ? official.data : official.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title="Documents" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText>Aadhaar (identity) is required. Use the camera, photo library, or a PDF.</AppText>
        <ChoiceChips options={PUJARI_DOC_TYPES.map((t) => ({ id: t.id, label: t.label }))} value={docType} onChange={(v) => setDocType(String(v))} />
        <MediaPicker
          allowFile
          onPicked={async (file) => {
            setError(null);
            try {
              await apiClient.uploadPujariDocument(file, docType);
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Upload failed");
            }
          }}
        />
        {(q.data || []).map((d) => (
          <Card key={d.id}>
            <AppText variant="h3">{d.document_type}</AppText>
            {d.status ? <StatusBadge status={String(d.status)} /> : null}
          </Card>
        ))}
        {officialRows.length > 0 ? <AppText variant="h3">Official documents</AppText> : null}
        {officialRows.map((d, i) => (
          <Card key={i}>
            <AppText>{String((d as { title?: string; document_type?: string }).title || (d as { document_type?: string }).document_type || "Document")}</AppText>
            {(d as { status?: string }).status ? <StatusBadge status={String((d as { status?: string }).status)} /> : null}
          </Card>
        ))}
        <PrimaryButton title="Go to Angikara" variant="outline" onPress={() => router.push("/pujari/angikara")} />
      </ScrollView>
    </Screen>
  );
}
