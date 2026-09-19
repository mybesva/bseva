import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Ticket = { id: string; subject?: string; status?: string; category?: string; description?: string; body?: string };

export default function AdminSupport() {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => apiClient.listSupportTickets(),
  });
  const rows = (list.data || []) as Ticket[];
  return (
    <Screen>
      <ScreenHeader title={t("admin.support")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((ticket) => (
          <Card key={ticket.id}>
            <StatusBadge status={String(ticket.status || "open")} />
            <AppText variant="h3">{ticket.subject}</AppText>
            <AppText variant="small">{ticket.category}</AppText>
            <AppText variant="small">{ticket.description || ticket.body}</AppText>
            <ChoiceChips
              options={[
                { id: "open", label: "Open" },
                { id: "in_progress", label: "In Progress" },
                { id: "waiting_for_user", label: "Waiting for User" },
                { id: "escalated", label: "Escalated" },
                { id: "resolved", label: "Resolved" },
                { id: "closed", label: "Closed" },
              ]}
              value={status || String(ticket.status || "open")}
              onChange={(v) => setStatus(String(v))}
            />
            <PrimaryButton
              title="Update status"
              variant="outline"
              onPress={async () => {
                setError(null);
                try {
                  await apiClient.api(`/support/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ status: status || ticket.status }) });
                  await list.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
