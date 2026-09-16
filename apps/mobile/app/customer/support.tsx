import { CUSTOMER_SUPPORT_CATS, PUJARI_SUPPORT_CATS, isPujariRole } from "@bseva/config";
import { supportSchema } from "@bseva/validation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function SupportScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const cats = isPujariRole(user?.role) ? PUJARI_SUPPORT_CATS : CUSTOMER_SUPPORT_CATS;
  const q = useQuery({ queryKey: ["tickets"], queryFn: () => apiClient.listSupportTickets() });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(cats[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <ScreenHeader title={t("mobile.support")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText variant="small">{t("mobile.category")}</AppText>
        <ChoiceChips
          options={cats.map((c) => ({ id: c, label: c }))}
          value={category}
          onChange={(v) => setCategory(String(v))}
        />
        <Field label={t("mobile.subject")} value={subject} onChangeText={setSubject} />
        <Field label={t("mobile.description")} value={body} onChangeText={setBody} multiline />
        <PrimaryButton
          title={busy ? t("mobile.submitting") : t("mobile.submitTicket")}
          loading={busy}
          onPress={async () => {
            const parsed = supportSchema.safeParse({ subject, body });
            if (!parsed.success) {
              setError(t("mobile.checkForm"));
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await apiClient.createSupportTicket({ category, subject, description: body, body });
              setSubject("");
              setBody("");
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            } finally {
              setBusy(false);
            }
          }}
        />
        {!q.isLoading && (q.data || []).length === 0 ? <EmptyState title={t("mobile.noTickets")} /> : null}
        {(q.data || []).map((t) => (
          <Card key={t.id}>
            <AppText variant="h3">{t.subject}</AppText>
            <AppText variant="small">{String(t.category || t.body || "")}</AppText>
            {t.status ? <StatusBadge status={t.status} /> : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
