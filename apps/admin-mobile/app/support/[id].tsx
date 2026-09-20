import {
  SUPPORT_ESCALATIONS,
  SUPPORT_NOTE_KINDS,
  SUPPORT_PRIORITIES,
  SUPPORT_RESOLUTIONS,
  TICKET_STATUSES,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";

type Event = {
  id: string;
  event_type?: string;
  actor_name?: string;
  actor_role?: string;
  visibility?: string;
  body?: string;
  previous_value?: string;
  new_value?: string;
  created_at?: string;
};

type Ticket = Record<string, unknown> & {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  description?: string;
  events?: Event[];
};

export default function AdminSupportTicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [noteKind, setNoteKind] = useState("reply");
  const [escTo, setEscTo] = useState("senior_support");
  const [escReason, setEscReason] = useState("");
  const [escAction, setEscAction] = useState("");
  const [resType, setResType] = useState("information_provided");
  const [resDetails, setResDetails] = useState("");
  const [outcome, setOutcome] = useState("yes");
  const [busy, setBusy] = useState(false);
  const ticketQ = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => apiClient.getSupportTicket(id),
    enabled: !!id,
  });
  const meta = useQuery({
    queryKey: ["support-meta"],
    queryFn: () => apiClient.api<{ agents?: { id: string; name?: string }[] }>("/support/tickets/meta"),
  });
  const ticket = ticketQ.data as Ticket | undefined;
  const events = Array.isArray(ticket?.events) ? ticket.events : [];
  const agents = meta.data?.agents || [];

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(path, { method: "POST", body: JSON.stringify(body) });
      await ticketQ.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(`/support/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await ticketQ.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (ticketQ.isLoading || !ticket) {
    return (
      <Screen>
        <ScreenHeader title="Ticket" back />
        {ticketQ.isLoading ? <LoadingBlock /> : <ErrorBanner message="Not found" />}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={String(ticket.ticket_number || ticket.subject || "Ticket")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card>
          <StatusBadge status={String(ticket.status || "open")} />
          <AppText variant="h3">{String(ticket.subject || "")}</AppText>
          <AppText variant="small">{String(ticket.description || "")}</AppText>
        </Card>
        <ChoiceChips
          options={TICKET_STATUSES.map((s) => ({ id: s, label: s.replace(/_/g, " ") }))}
          value={String(ticket.status || "open")}
          onChange={(v) => void patch({ status: String(v) })}
        />
        {(ticket.status === "resolved" || ticket.status === "closed") ? (
          <PrimaryButton title="Reopen" variant="outline" loading={busy} onPress={() => void post(`/support/tickets/${id}/reopen`, {})} />
        ) : null}
        <AppText variant="small">Priority</AppText>
        <ChoiceChips
          options={SUPPORT_PRIORITIES.map((p) => ({ id: p.id, label: p.label }))}
          value={String(ticket.priority || "medium")}
          onChange={(v) => void patch({ priority: String(v) })}
        />
        <AppText variant="small">Assigned agent</AppText>
        <ChoiceChips
          options={[{ id: "none", label: "Unassigned" }, ...agents.map((a) => ({ id: a.id, label: a.name || a.id }))]}
          value={String(ticket.assigned_admin_id || "none")}
          onChange={(v) => void patch(String(v) === "none" ? { unassign: true } : { assigned_admin_id: String(v) })}
        />
        <Card>
          <AppText variant="h3">Conversation / activity</AppText>
          {events.length === 0 ? <AppText variant="small">No activity yet.</AppText> : null}
          {events.map((ev) => (
            <Card key={ev.id}>
              <AppText variant="small">
                {ev.event_type} · {ev.actor_name || ev.actor_role || "System"}
                {ev.visibility === "internal" ? " · Internal" : ""}
              </AppText>
              {ev.body ? <AppText>{ev.body}</AppText> : null}
            </Card>
          ))}
          <ChoiceChips options={SUPPORT_NOTE_KINDS.map((k) => ({ id: k.id, label: k.label }))} value={noteKind} onChange={(v) => setNoteKind(String(v))} />
          <Field label="Write a reply or note" value={reply} onChangeText={setReply} multiline />
          <PrimaryButton
            title={noteKind === "reply" ? "Send reply" : "Add note"}
            loading={busy}
            onPress={() => {
              if (!reply.trim()) return;
              void post(`/support/tickets/${id}/messages`, { body: reply.trim(), kind: noteKind }).then(() => setReply(""));
            }}
          />
        </Card>
        <Card>
          <AppText variant="h3">Escalation</AppText>
          <ChoiceChips options={SUPPORT_ESCALATIONS.map((e) => ({ id: e.id, label: e.label }))} value={escTo} onChange={(v) => setEscTo(String(v))} />
          <Field label="Escalation reason" value={escReason} onChangeText={setEscReason} multiline />
          <Field label="Required action" value={escAction} onChangeText={setEscAction} />
          <PrimaryButton
            title="Escalate"
            variant="outline"
            loading={busy}
            onPress={() => {
              if (escReason.trim().length < 5) {
                setError("Escalation reason must be at least 5 characters");
                return;
              }
              void post(`/support/tickets/${id}/escalate`, {
                escalated_to: escTo,
                reason: escReason.trim(),
                required_action: escAction.trim() || undefined,
              });
            }}
          />
        </Card>
        <Card>
          <AppText variant="h3">Resolution</AppText>
          <ChoiceChips options={SUPPORT_RESOLUTIONS.map((e) => ({ id: e.id, label: e.label }))} value={resType} onChange={(v) => setResType(String(v))} />
          <ChoiceChips
            options={[
              { id: "yes", label: "Resolved — Yes" },
              { id: "partially", label: "Partially" },
              { id: "no", label: "No" },
            ]}
            value={outcome}
            onChange={(v) => setOutcome(String(v))}
          />
          <Field label="Resolution details" value={resDetails} onChangeText={setResDetails} multiline />
          <PrimaryButton
            title="Mark resolved"
            loading={busy}
            onPress={() => {
              if (resDetails.trim().length < 5) {
                setError("Resolution details must be at least 5 characters");
                return;
              }
              void post(`/support/tickets/${id}/resolve`, {
                resolution_type: resType,
                resolution_details: resDetails.trim(),
                outcome,
              });
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
