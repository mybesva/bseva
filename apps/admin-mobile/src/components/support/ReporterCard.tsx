import { View } from "react-native";
import { AppText, Card } from "@/components/ui";
import { REPORTER_LABELS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";
import type { SupportTicketRow } from "./types";

function InfoRow({ label, value }: { label: string; value?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
      <AppText variant="small" color={colors.mutedForeground} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="small" style={{ flex: 1.2, textAlign: "right", fontWeight: "600" }} numberOfLines={2}>
        {value || "—"}
      </AppText>
    </View>
  );
}

export function ReporterCard({ ticket }: { ticket: SupportTicketRow }) {
  const { colors } = useAppTheme();

  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="h3" color={colors.navy}>
        Reporter
      </AppText>
      <InfoRow
        label="Type"
        value={String(REPORTER_LABELS[String(ticket.reporter_type || "")] || ticket.reporter_type || "—")}
      />
      <InfoRow label="Name" value={String(ticket.reporter_name || ticket.guest_name || "—")} />
      <InfoRow label="ID" value={String(ticket.reporter_public_id || ticket.user_id || "—")} />
      <InfoRow label="Phone" value={String(ticket.reporter_phone || ticket.guest_phone || "—")} />
      <InfoRow label="Email" value={String(ticket.reporter_email || ticket.guest_email || "—")} />
      {ticket.reporter_language ? <InfoRow label="Language" value={String(ticket.reporter_language)} /> : null}
    </Card>
  );
}
