import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, View } from "react-native";
import { WebView } from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { downloadAuthorizedFile } from "@/utils/files";

export default function AdminInvoiceHtml() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["invoice-html", id],
    queryFn: () => apiClient.invoiceHtml(id),
    enabled: !!id,
  });

  return (
    <Screen>
      <ScreenHeader title="Invoice" back />
      <View style={{ padding: 12 }}>
        <PrimaryButton
          title="Share PDF"
          variant="outline"
          onPress={() =>
            void downloadAuthorizedFile(`/invoices/${id}/pdf`, `invoice-${id}.pdf`, "application/pdf").catch((e: unknown) =>
              Alert.alert("Invoice", e instanceof Error ? e.message : "Failed")
            )
          }
        />
      </View>
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : "Failed"} /> : null}
      {q.data ? <WebView originWhitelist={["*"]} source={{ html: q.data }} style={{ flex: 1 }} /> : null}
    </Screen>
  );
}
