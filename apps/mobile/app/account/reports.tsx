import { formatDisplayDateTime } from "@bseva/locales";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS, REPORT_TARGET_LABELS, text } from "@/content/compliance";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { apiErrorMessage } from "@/utils/userMessage";

export default function MyReportsScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const q = useQuery({ queryKey: ["my-reports"], queryFn: () => apiClient.myReports() });
  const rows = q.data || [];
  return (
    <Screen>
      <ScreenHeader title={text.myReports} back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBanner message={apiErrorMessage(t, q.error, "mobile.failed")} /> : null}
        {!q.isLoading && !q.error && rows.length === 0 ? <EmptyState title={text.noReports} /> : null}
        {rows.map((r) => (
          <Card key={r.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <AppText style={{ fontWeight: "700", flex: 1 }}>
                {REPORT_TARGET_LABELS[r.target_type] || r.target_type} ·{" "}
                {REPORT_REASON_LABELS[r.reason as keyof typeof REPORT_REASON_LABELS] || r.reason}
              </AppText>
              <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                {REPORT_STATUS_LABELS[r.status] || r.status}
              </AppText>
            </View>
            <AppText variant="small" color={colors.mutedForeground}>
              {formatDisplayDateTime(r.created_at)}
            </AppText>
            {r.resolution ? (
              <AppText variant="small" style={{ marginTop: 4 }}>
                {text.resolution}: {r.resolution}
              </AppText>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
