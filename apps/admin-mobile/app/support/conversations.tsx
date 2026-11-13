import { displayTokenLabel } from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type SupportConversation = {
  id: string;
  subject?: string | null;
  status?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  ticket_id?: string | null;
  ticket_number?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const SUPPORT_CONVERSATIONS_KEY = ["support-conversations"] as const;

function isOpenConversation(c: SupportConversation) {
  return !["closed", "resolved"].includes(String(c.status || "open"));
}

export default function SupportConversations() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState("open");
  const list = useQuery({
    queryKey: SUPPORT_CONVERSATIONS_KEY,
    queryFn: () => apiClient.api<SupportConversation[]>("/support/conversations"),
  });
  const all = Array.isArray(list.data) ? list.data : [];
  const openCount = all.filter(isOpenConversation).length;
  const rows = useMemo(() => (filter === "open" ? all.filter(isOpenConversation) : all), [all, filter]);

  return (
    <Screen>
      <ScreenHeader title="Live Chat" back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => void list.refetch()} />}
      >
        <AppText variant="small" color={colors.mutedForeground}>
          In-app chats from customers. Open one to reply or convert it to a ticket.
        </AppText>
        <ChoiceChips
          horizontal
          options={[
            { id: "open", label: `Open · ${openCount}` },
            { id: "all", label: `All · ${all.length}` },
          ]}
          value={filter}
          onChange={(v) => setFilter(String(v))}
        />
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed to load chats"} /> : null}
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? <EmptyState title="No chats." /> : null}
        {rows.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/support/conversation/[id]", params: { id: c.id } })}
          >
            <Card compact>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {c.subject || "Chat"}
                </AppText>
                <StatusBadge status={String(c.status || "open")} />
              </View>
              <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
                {c.customer_name || c.customer_id || "—"}
                {c.ticket_number ? ` · ${c.ticket_number}` : ""}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <AppText variant="small" color={colors.mutedForeground}>
                  {displayTokenLabel(String(c.status || "open"))}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
