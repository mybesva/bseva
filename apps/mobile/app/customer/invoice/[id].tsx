import { TOKEN_KEY } from "@bseva/tokens";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { WebView } from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient, resolveApiBase } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function InvoiceHtmlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["invoice-html", id],
    queryFn: () => apiClient.invoiceHtml(id),
    enabled: !!id,
  });

  async function sharePdf() {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const path = `${FileSystem.cacheDirectory}invoice-${id}.pdf`;
      const result = await FileSystem.downloadAsync(
        `${resolveApiBase()}/api/v1/invoices/${id}/pdf`,
        path,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      if (result.status >= 400) throw new Error(t("mobile.invoiceDownloadFailed"));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      }
    } catch (e: unknown) {
      Alert.alert(t("mobile.invoice"), e instanceof Error ? e.message : t("mobile.invoiceShareFailed"));
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("mobile.invoices")} back />
      <View style={{ padding: 12 }}>
        <PrimaryButton title={t("mobile.downloadPdf")} variant="outline" onPress={() => void sharePdf()} />
      </View>
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : t("mobile.invoiceLoadFailed")} /> : null}
      {q.data ? <WebView originWhitelist={["*"]} source={{ html: q.data }} style={{ flex: 1 }} /> : null}
    </Screen>
  );
}
