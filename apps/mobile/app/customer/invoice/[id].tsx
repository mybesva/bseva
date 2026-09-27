import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { cacheAuthorizedPdf, downloadAuthorizedPdf, pdfAlert, shareCachedPdf } from "@/utils/documentPdf";

function InvoiceActionButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  primary,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 46,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: primary ? colors.primary : "transparent",
        borderWidth: primary ? 0 : 1.5,
        borderColor: colors.primary,
        opacity: disabled || loading ? 0.55 : pressed ? 0.88 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.primaryForeground : colors.primary} />
      ) : (
        <Ionicons name={icon} size={18} color={primary ? colors.primaryForeground : colors.primary} />
      )}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: primary ? colors.primaryForeground : colors.primary,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function InvoiceHtmlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const stackActions = width < 360;
  const q = useQuery({
    queryKey: ["invoice-html", id],
    queryFn: () => apiClient.invoiceHtml(id),
    enabled: !!id,
  });

  async function downloadPdf() {
    setBusy("download");
    try {
      await downloadAuthorizedPdf(`/api/v1/invoices/${id}/pdf`, `invoice-${id}.pdf`);
      pdfAlert(t("mobile.invoices"), t("mobile.invoiceSaved"));
    } catch (e: unknown) {
      pdfAlert(t("mobile.invoices"), e instanceof Error ? e.message : t("mobile.invoiceDownloadFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy("share");
    try {
      const cached = await cacheAuthorizedPdf(`/api/v1/invoices/${id}/pdf`, `invoice-${id}.pdf`);
      await shareCachedPdf(cached);
    } catch (e: unknown) {
      pdfAlert(t("mobile.invoices"), e instanceof Error ? e.message : t("mobile.invoiceShareFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("mobile.invoices")} back />
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
        <View style={{ flexDirection: stackActions ? "column" : "row", gap: 8 }}>
          <InvoiceActionButton
            label={t("mobile.downloadPdf")}
            icon="download-outline"
            primary
            loading={busy === "download"}
            disabled={busy != null}
            onPress={() => void downloadPdf()}
          />
          <InvoiceActionButton
            label={t("mobile.shareInvoice")}
            icon="share-outline"
            loading={busy === "share"}
            disabled={busy != null}
            onPress={() => void sharePdf()}
          />
        </View>
      </View>
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : t("mobile.invoiceLoadFailed")} /> : null}
      {q.data ? <DocumentViewer html={q.data} /> : null}
    </Screen>
  );
}
