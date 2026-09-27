import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { cacheAuthorizedPdf, downloadAuthorizedPdf, pdfAlert, shareCachedPdf } from "@/utils/documentPdf";

export default function BookingReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const q = useQuery({
    queryKey: ["receipt-html", id],
    queryFn: () => apiClient.bookingReceiptHtml(id),
    enabled: !!id,
  });

  async function downloadPdf() {
    setBusy("download");
    try {
      await downloadAuthorizedPdf(`/api/v1/bookings/${id}/receipt/pdf`, `receipt-${id}.pdf`);
      pdfAlert(t("web.booking.receipt"), t("mobile.invoiceSaved"));
    } catch (e: unknown) {
      pdfAlert(t("web.booking.receipt"), e instanceof Error ? e.message : t("mobile.invoiceDownloadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy("share");
    try {
      const cached = await cacheAuthorizedPdf(`/api/v1/bookings/${id}/receipt/pdf`, `receipt-${id}.pdf`);
      await shareCachedPdf(cached);
    } catch (e: unknown) {
      pdfAlert(t("web.booking.receipt"), e instanceof Error ? e.message : t("mobile.invoiceShareFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("web.booking.receipt")} back />
      <View style={{ padding: 12, gap: 8 }}>
        <PrimaryButton title={t("mobile.downloadPdf")} variant="outline" loading={busy === "download"} disabled={busy != null} onPress={() => void downloadPdf()} />
        <PrimaryButton title={`${t("mobile.share")} ${t("web.booking.receipt")}`} variant="ghost" loading={busy === "share"} disabled={busy != null} onPress={() => void sharePdf()} />
      </View>
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : t("web.booking.loadFailed")} /> : null}
      {q.data ? <DocumentViewer html={q.data} /> : null}
    </Screen>
  );
}
