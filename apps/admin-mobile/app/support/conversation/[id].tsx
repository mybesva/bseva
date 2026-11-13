import { displayTokenLabel } from "@bseva/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, ErrorBanner, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

// Same shape/key as app/support/conversations.tsx (route files should not import each other).
type SupportConversation = {
  id: string;
  subject?: string | null;
  status?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  ticket_number?: string | null;
};
const SUPPORT_CONVERSATIONS_KEY = ["support-conversations"] as const;

type ChatMessage = {
  id: string;
  body?: string | null;
  sender_role?: string | null;
  sender_name?: string | null;
  created_at?: string | null;
};

function fmtTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const AGENT_ROLES = new Set(["admin", "agent", "support", "support_agent", "staff"]);

export default function SupportConversationThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversations = useQuery({
    queryKey: SUPPORT_CONVERSATIONS_KEY,
    queryFn: () => apiClient.api<SupportConversation[]>("/support/conversations"),
  });
  const conv = (Array.isArray(conversations.data) ? conversations.data : []).find((c) => c.id === id);

  const messages = useQuery({
    queryKey: ["support-conversation-messages", id],
    queryFn: () => apiClient.api<ChatMessage[]>(`/support/conversations/${id}/messages`),
    enabled: !!id,
  });
  const rows = Array.isArray(messages.data) ? messages.data : [];

  async function send() {
    const body = reply.trim();
    if (!id || !body) return;
    setSending(true);
    setError(null);
    try {
      await apiClient.api(`/support/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setReply("");
      await messages.refetch();
      void qc.invalidateQueries({ queryKey: SUPPORT_CONVERSATIONS_KEY });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function convert() {
    if (!id) return;
    Alert.alert(
      "Convert to ticket?",
      conv?.ticket_number ? `This chat is linked to ${conv.ticket_number}. Open / link it again?` : "Create a support ticket from this chat?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert",
          onPress: () =>
            void (async () => {
              setConverting(true);
              setError(null);
              try {
                const res = await apiClient.api<{ id: string }>(`/support/conversations/${id}/to-ticket`, {
                  method: "POST",
                  body: JSON.stringify({}),
                });
                await qc.invalidateQueries({ queryKey: SUPPORT_CONVERSATIONS_KEY });
                await qc.invalidateQueries({ queryKey: ["support-tickets"] });
                if (res?.id) router.push(`/support/${res.id}`);
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to convert");
              } finally {
                setConverting(false);
              }
            })(),
        },
      ]
    );
  }

  return (
    <Screen watermark={false}>
      <ScreenHeader title={conv?.subject || "Chat"} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={messages.isFetching} onRefresh={() => void messages.refetch()} />}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {conv ? (
            <Card compact>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <AppText variant="small" style={{ flex: 1, fontWeight: "600" }}>
                  {conv.customer_name || conv.customer_id || "—"}
                  {conv.ticket_number ? ` · ${conv.ticket_number}` : ""}
                </AppText>
                <StatusBadge status={String(conv.status || "open")} />
              </View>
            </Card>
          ) : null}
          <ErrorBanner message={error} />
          {messages.error ? (
            <ErrorBanner message={messages.error instanceof Error ? messages.error.message : "Failed to load messages"} />
          ) : null}
          {messages.isLoading ? <LoadingBlock /> : null}
          {!messages.isLoading && rows.length === 0 ? <EmptyState title="No messages yet." /> : null}
          {rows.map((m) => {
            const mine = AGENT_ROLES.has(String(m.sender_role || "").toLowerCase());
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  backgroundColor: mine ? colors.primary + "18" : colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  gap: 2,
                }}
              >
                <AppText variant="small" color={colors.mutedForeground} style={{ fontWeight: "600" }}>
                  {displayTokenLabel(m.sender_role, "")}
                  {m.sender_name ? ` · ${m.sender_name}` : ""}
                  {m.created_at ? ` · ${fmtTime(m.created_at)}` : ""}
                </AppText>
                <AppText>{String(m.body || "")}</AppText>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Reply as agent…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            accessibilityLabel="Reply"
            style={{
              minHeight: 48,
              maxHeight: 120,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.foreground,
              backgroundColor: colors.input,
              fontSize: 16,
            }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Send" onPress={() => void send()} loading={sending} disabled={!reply.trim()} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Convert / Link Ticket" variant="outline" onPress={convert} loading={converting} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
