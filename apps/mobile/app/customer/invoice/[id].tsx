import { rupees } from "@bseva/config";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { WebView } from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function InvoiceHtmlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["invoice-html", id],
    queryFn: () => apiClient.invoiceHtml(id),
    enabled: !!id,
  });
  return (
    <Screen>
      <ScreenHeader title="Invoice" back />
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : "Could not load invoice"} /> : null}
      {q.data ? <WebView originWhitelist={["*"]} source={{ html: q.data }} style={{ flex: 1 }} /> : null}
    </Screen>
  );
}
