import { View } from "react-native";
import { AppText, Card } from "@/components/ui";
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

export function BookingInfoCard({ ticket }: { ticket: SupportTicketRow }) {
  const { colors } = useAppTheme();
  const booking = (ticket.booking || {}) as Record<string, unknown>;
  if (!ticket.related_booking_id) return null;

  const dateTime = `${String(booking.booking_date || ticket.booking_date || "—")} ${String(booking.start_time || ticket.start_time || "").trim()}`.trim();

  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="h3" color={colors.navy}>
        Booking / Seva
      </AppText>
      <InfoRow label="Booking ID" value={String(booking.booking_number || ticket.booking_number || ticket.related_booking_id)} />
      <InfoRow label="Puja / Service" value={String(booking.service_name || ticket.service_name || "—")} />
      <InfoRow label="Date & Time" value={dateTime} />
      <InfoRow
        label="Location"
        value={String(booking.location_label || booking.address || ticket.booking_location || "—")}
      />
      <InfoRow label="Customer" value={String(booking.customer_name || ticket.booking_customer_name || "—")} />
      <InfoRow label="Assigned pujari" value={String(booking.pujari_name || ticket.booking_pujari_name || "—")} />
    </Card>
  );
}
