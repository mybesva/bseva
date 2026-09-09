import { CUSTOMER_SUPPORT_CATS, PUJARI_SUPPORT_CATS, isPujariRole } from "@bseva/config";
import { supportSchema } from "@bseva/validation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";

export default function SupportScreen() {
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
      <ScreenHeader title="Support" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText variant="small">Category</AppText>
        <ChoiceChips
          options={cats.map((c) => ({ id: c, label: c }))}
          value={category}
          onChange={(v) => setCategory(String(v))}
        />
        <Field label="Subject" value={subject} onChangeText={setSubject} />
        <Field label="Description" value={body} onChangeText={setBody} multiline />
        <PrimaryButton
          title={busy ? "Submitting..." : "Submit ticket"}
          loading={busy}
          onPress={async () => {
            const parsed = supportSchema.safeParse({ subject, body });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message || "Check the form");
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
              setError(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
        {!q.isLoading && (q.data || []).length === 0 ? <EmptyState title="No tickets yet." /> : null}
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
