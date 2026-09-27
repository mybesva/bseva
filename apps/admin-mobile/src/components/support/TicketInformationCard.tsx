import { View } from "react-native";
import { formatDisplayDateTime } from "@bseva/locales";
import { AppText, Card } from "@/components/ui";
import { CATEGORY_LABELS, PRIORITY_LABELS, SOURCE_LABELS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";
import type { SupportTicketRow } from "./types";

function InfoRow({ label, value }: { label: string; value?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
      <AppText variant="small" color={colors.mutedForeground} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="small" style={{ flex: 1.2, textAlign: "right", fontWeight: "600" }} numberOfLines={3}>
        {value || "—"}
      </AppText>
    </View>
  );
}

export function TicketInformationCard({
  ticket,
  agentName,
}: {
  ticket: SupportTicketRow;
  agentName?: string;
}) {
  const { colors } = useAppTheme();
  const sla =
    ticket.sla_due_at
      ? `${formatDisplayDateTime(ticket.sla_due_at)}${ticket.sla_hours ? ` (${ticket.sla_hours}h)` : ""}`
      : "—";

  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="h3" color={colors.navy}>
        Ticket Information
      </AppText>
      <InfoRow
        label="Category"
        value={String(ticket.category_label || CATEGORY_LABELS[String(ticket.category || "")] || ticket.category || "—")}
      />
      <InfoRow label="Created" value={formatDisplayDateTime(ticket.created_at)} />
      <InfoRow label="Last activity" value={formatDisplayDateTime(ticket.last_activity_at || ticket.updated_at)} />
      <InfoRow label="SLA / target" value={sla} />
      <InfoRow
        label="Priority"
        value={String(ticket.priority_label || PRIORITY_LABELS[String(ticket.priority || "")] || ticket.priority || "—")}
      />
      <InfoRow
        label="Contact source"
        value={String(SOURCE_LABELS[String(ticket.contact_source || "")] || ticket.contact_source || "—")}
      />
      <InfoRow label="Agent" value={agentName || (ticket.assigned_admin_id ? "Assigned" : "Unassigned")} />
    </Card>
  );
}
