import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] || "").trim();
    });
    return row;
  });
}

export default function AdminBulkImport() {
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number>(0);

  return (
    <Screen>
      <ScreenHeader title="Bulk import" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card style={{ gap: 8 }}>
          <AppText variant="h3">Temples CSV</AppText>
          <AppText variant="small">
            Same endpoint as web: POST /admin/temples/bulk. Other entity types still use the individual admin screens.
          </AppText>
          {preview ? <AppText>Rows ready: {preview}</AppText> : null}
          {summary ? <AppText>{summary}</AppText> : null}
          <PrimaryButton
            title={busy ? "Importing…" : "Pick CSV and import temples"}
            loading={busy}
            onPress={async () => {
              setError(null);
              setSummary(null);
              const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: "text/csv" });
              if (picked.canceled || !picked.assets?.[0]?.uri) return;
              try {
                setBusy(true);
                const text = await (await fetch(picked.assets[0].uri)).text();
                const items = parseCsv(text);
                setPreview(items.length);
                const result = await apiClient.api<{
                  total?: number;
                  success?: number;
                  failed?: number;
                  created?: number;
                  updated?: number;
                }>("/admin/temples/bulk", { method: "POST", body: JSON.stringify({ items }) });
                setSummary(
                  `Imported ${result.success ?? 0} of ${result.total ?? items.length} (${result.created ?? 0} new, ${result.updated ?? 0} updated, ${result.failed ?? 0} failed)`
                );
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Import failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
