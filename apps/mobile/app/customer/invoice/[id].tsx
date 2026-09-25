import { TOKEN_KEY } from "@bseva/tokens";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { WebView } from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient, resolveApiBase } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

type StorageAccess = {
  requestDirectoryPermissionsAsync: () => Promise<{ granted: boolean; directoryUri: string }>;
  createFileAsync: (directoryUri: string, fileName: string, mimeType: string) => Promise<string>;
};

function storageAccess(): StorageAccess | null {
  const api = FileSystem as unknown as { StorageAccessFramework?: StorageAccess };
  return api.StorageAccessFramework ?? null;
}

export default function InvoiceHtmlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const q = useQuery({
    queryKey: ["invoice-html", id],
    queryFn: () => apiClient.invoiceHtml(id),
    enabled: !!id,
  });

  async function cachedPdf(): Promise<string> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const path = `${FileSystem.cacheDirectory}invoice-${id}.pdf`;
    const result = await FileSystem.downloadAsync(
      `${resolveApiBase()}/api/v1/invoices/${id}/pdf`,
      path,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    if (result.status >= 400) throw new Error(t("mobile.invoiceDownloadFailed"));
    return result.uri;
  }

  async function downloadPdf() {
    setBusy("download");
    try {
      const cached = await cachedPdf();
      const fileName = `invoice-${id}.pdf`;
      const saf = Platform.OS === "android" ? storageAccess() : null;
      if (saf) {
        const perm = await saf.requestDirectoryPermissionsAsync();
        if (!perm.granted) return;
        const dest = await saf.createFileAsync(perm.directoryUri, fileName, "application/pdf");
        const base64 = await FileSystem.readAsStringAsync(cached, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        const dest = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: cached, to: dest });
      }
      Alert.alert(t("mobile.invoice"), t("mobile.invoiceSaved"));
    } catch (e: unknown) {
      Alert.alert(t("mobile.invoice"), e instanceof Error ? e.message : t("mobile.invoiceDownloadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy("share");
    try {
      const cached = await cachedPdf();
      if (!(await Sharing.isAvailableAsync())) throw new Error(t("mobile.invoiceShareFailed"));
      await Sharing.shareAsync(cached, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch (e: unknown) {
      Alert.alert(t("mobile.invoice"), e instanceof Error ? e.message : t("mobile.invoiceShareFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("mobile.invoices")} back />
      <View style={{ padding: 12, gap: 8 }}>
        <PrimaryButton title={t("mobile.downloadPdf")} variant="outline" loading={busy === "download"} disabled={busy != null} onPress={() => void downloadPdf()} />
        <PrimaryButton title={t("mobile.shareInvoice")} variant="ghost" loading={busy === "share"} disabled={busy != null} onPress={() => void sharePdf()} />
      </View>
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : t("mobile.invoiceLoadFailed")} /> : null}
      {q.data ? <WebView originWhitelist={["*"]} source={{ html: q.data }} style={{ flex: 1 }} /> : null}
    </Screen>
  );
}
