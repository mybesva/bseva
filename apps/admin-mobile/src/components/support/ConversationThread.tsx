import { View } from "react-native";
import { formatDisplayDateTime } from "@bseva/locales";
import { AppText, Card } from "@/components/ui";
import { EVENT_LABELS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";
import type { SupportEvent } from "./types";

function eventActor(ev: SupportEvent) {
  if (ev.actor_name) return ev.actor_name;
  if (ev.event_type === "user_message") return "Customer/Pujari";
  if (ev.event_type === "admin_reply") return "Admin";
  return ev.actor_role || "System";
}

export function ConversationThread({ events }: { events: SupportEvent[] }) {
  const { colors } = useAppTheme();
  const visible = events.filter((ev) => ev.body || ev.previous_value || ev.new_value);

  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="h3" color={colors.navy}>
        Conversation
      </AppText>
      {visible.length === 0 ? (
        <AppText variant="small" color={colors.mutedForeground}>
          No activity yet.
        </AppText>
      ) : (
        visible.map((ev) => {
          const internal = ev.visibility === "internal";
          const label = EVENT_LABELS[String(ev.event_type || "")] || String(ev.event_type || "Activity");
          return (
            <View
              key={ev.id}
              style={{
                borderWidth: 1,
                borderColor: internal ? colors.warning : colors.border,
                backgroundColor: internal ? colors.warning + "12" : colors.background,
                borderRadius: 10,
                padding: 12,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <AppText variant="small" style={{ fontWeight: "700", flex: 1 }}>
                  {eventActor(ev)}
                  {internal ? " · Internal" : ""}
                </AppText>
                <AppText variant="small" color={colors.mutedForeground}>
                  {formatDisplayDateTime(ev.created_at)}
                </AppText>
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                {label}
              </AppText>
              {ev.body ? <AppText style={{ lineHeight: 20 }}>{ev.body}</AppText> : null}
              {ev.previous_value || ev.new_value ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {ev.previous_value || "—"} → {ev.new_value || "—"}
                </AppText>
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}
