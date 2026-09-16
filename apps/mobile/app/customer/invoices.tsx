import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function InvoicesScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => apiClient.invoices() });
  return (
    <Screen>
      <ScreenHeader title={t("mobile.invoices")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {q.isLoading ? <LoadingBlock /> : null}
        {!q.isLoading && (q.data || []).length === 0 ? <EmptyState title={t("mobile.noInvoices")} /> : null}
        {(q.data || []).map((inv) => (
          <Card key={inv.id}>
            <AppText variant="h3">{String(inv.invoice_number || inv.type || t("mobile.invoice"))}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {String(inv.type || "")} · {inv.created_at}
            </AppText>
            {inv.total_paise != null ? <AppText color={colors.primary}>{rupees(Number(inv.total_paise))}</AppText> : null}
            <PrimaryButton title={t("mobile.view")} variant="outline" onPress={() => router.push(`/customer/invoice/${inv.id}`)} />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
