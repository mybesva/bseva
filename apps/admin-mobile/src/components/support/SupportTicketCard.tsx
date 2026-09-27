import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { formatDisplayDateTime } from "@bseva/locales";
import { AppText, Card } from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";
import { SupportPriorityBadge } from "./SupportPriorityBadge";
import { SupportStatusBadge } from "./SupportStatusBadge";
import type { SupportTicketRow } from "./types";

export function SupportTicketCard({ ticket }: { ticket: SupportTicketRow }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const category =
    String(ticket.category_label || CATEGORY_LABELS[String(ticket.category || "")] || ticket.category || "");
  const reporter = String(ticket.reporter_name || ticket.guest_name || "—");
  const service = String(ticket.service_name || ticket.booking?.service_name || "");
  const lastActivity = formatDisplayDateTime(ticket.last_activity_at || ticket.updated_at || ticket.created_at);

  return (
    <Card style={{ gap: 10, borderColor: colors.primary + "33" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <SupportStatusBadge status={String(ticket.status || "open")} />
        <SupportPriorityBadge priority={String(ticket.priority || "medium")} />
      </View>

      <AppText variant="small" color={colors.mutedForeground} style={{ fontWeight: "700", letterSpacing: 0.3 }}>
        {String(ticket.ticket_number || ticket.id)}
      </AppText>
      <AppText variant="h3" numberOfLines={2}>
        {String(ticket.subject || "Untitled ticket")}
      </AppText>
      {category ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {category}
        </AppText>
      ) : null}
      <AppText variant="body" numberOfLines={1}>
        {reporter}
      </AppText>
      {service ? (
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
          {service}
        </AppText>
      ) : null}
      <AppText variant="small" color={colors.mutedForeground}>
        Last activity: {lastActivity}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View ticket"
        onPress={() => router.push(`/support/${ticket.id}`)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          paddingVertical: 8,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
          View Ticket
        </AppText>
        <Ionicons name="arrow-forward" size={14} color={colors.primary} />
      </Pressable>
    </Card>
  );
}
