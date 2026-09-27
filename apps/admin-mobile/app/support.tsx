import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  SupportFilter,
  SupportTicketCard,
  type SupportTicketRow,
} from "@/components/support";
import { AppText, EmptyState, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { OPEN_TICKET_STATUSES } from "@/lib/supportLabels";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function AdminSupport() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const [statusFilter, setStatusFilter] = useState("");
  const list = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => apiClient.listSupportTickets(),
  });

  useEffect(() => {
    const next = typeof params.status === "string" ? params.status : "";
    if (next) setStatusFilter(next);
  }, [params.status]);

  const rows = useMemo(() => {
    const all = (list.data || []) as SupportTicketRow[];
    if (statusFilter === "open") {
      return all.filter((ticket) => OPEN_TICKET_STATUSES.has(String(ticket.status || "open").toLowerCase()));
    }
    if (statusFilter) {
      return all.filter((ticket) => String(ticket.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
    return all;
  }, [list.data, statusFilter]);

  return (
    <Screen>
      <ScreenHeader title={t("admin.support")} back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => void list.refetch()} />}
        keyboardShouldPersistTaps="handled"
      >
        <PrimaryButton title="+ Create Ticket" onPress={() => router.push("/support/create")} />
        <View style={{ gap: 8 }}>
          <AppText variant="small" style={{ fontWeight: "700" }}>
            Filter tickets
          </AppText>
          <SupportFilter value={statusFilter} onChange={setStatusFilter} />
        </View>
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? (
          <EmptyState title="No tickets found" subtitle="Create a ticket or adjust your filters." />
        ) : null}
        {rows.map((ticket) => (
          <SupportTicketCard key={ticket.id} ticket={ticket} />
        ))}
      </ScrollView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
