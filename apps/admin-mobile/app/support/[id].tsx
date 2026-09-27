import {
  SUPPORT_ESCALATIONS,
  SUPPORT_PRIORITIES,
  SUPPORT_RESOLUTIONS,
  TICKET_STATUSES,
} from "@bseva/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  BookingInfoCard,
  ConversationThread,
  ReplyComposer,
  ReporterCard,
  SupportPriorityBadge,
  SupportSelect,
  SupportStatusBadge,
  TicketInformationCard,
  type SupportTicketRow,
} from "@/components/support";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/supportLabels";
import { apiClient } from "@/services/api";

export default function AdminSupportTicketDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState("");
  const [statusInitialized, setStatusInitialized] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [escTo, setEscTo] = useState("senior_support");
  const [escReason, setEscReason] = useState("");
  const [escAction, setEscAction] = useState("");
  const [resType, setResType] = useState("information_provided");
  const [resDetails, setResDetails] = useState("");
  const [outcome, setOutcome] = useState("yes");

  const ticketQ = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => apiClient.getSupportTicket(id),
    enabled: !!id,
  });

  const meta = useQuery({
    queryKey: ["support-meta"],
    queryFn: () => apiClient.api<{ agents?: { id: string; name?: string }[] }>("/support/tickets/meta"),
  });

  const ticket = ticketQ.data as SupportTicketRow | undefined;
  const agents = meta.data?.agents || [];
  const events = Array.isArray(ticket?.events) ? ticket.events : [];
  const agentName = useMemo(() => {
    const agentId = ticket?.assigned_admin_id;
    if (!agentId) return undefined;
    return agents.find((a) => a.id === agentId)?.name;
  }, [agents, ticket?.assigned_admin_id]);

  useEffect(() => {
    if (ticket && !statusInitialized) {
      setStatusDraft(String(ticket.status || "open"));
      setStatusInitialized(true);
    }
  }, [ticket, statusInitialized]);

  const replyDisabled =
    ticket?.status === "closed" || ticket?.status === "resolved";

  async function refreshTicket() {
    await ticketQ.refetch();
    await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(`/support/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await refreshTicket();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(path, { method: "POST", body: JSON.stringify(body) });
      await refreshTicket();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReply(body: string, kind: string) {
    setSendingReply(true);
    setReplyError(null);
    setReplySuccess(null);
    try {
      await apiClient.api(`/support/tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, kind }),
      });
      await refreshTicket();
      setReplySuccess(kind === "reply" ? "Reply sent." : "Note added.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send reply";
      setReplyError(message);
      console.error("[Support] reply failed:", e);
      throw e;
    } finally {
      setSendingReply(false);
    }
  }

  async function handleUpdateStatus() {
    if (!statusDraft || statusDraft === ticket?.status) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await patch({ status: statusDraft });
    } catch {
      // error shown via banner
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (ticketQ.isLoading || !ticket) {
    return (
      <Screen>
        <ScreenHeader title="Ticket Details" back />
        {ticketQ.isLoading ? <LoadingBlock /> : <ErrorBanner message="Ticket not found" />}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Ticket Details" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner message={error} />

          <View style={{ gap: 8 }}>
            <AppText variant="small" style={{ fontWeight: "700", letterSpacing: 0.3 }}>
              {String(ticket.ticket_number || ticket.id)}
            </AppText>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <SupportStatusBadge status={String(ticket.status || "open")} />
              <SupportPriorityBadge priority={String(ticket.priority || "medium")} />
            </View>
            <AppText variant="h3">{String(ticket.subject || "")}</AppText>
          </View>

          <Card style={{ gap: 10 }}>
            <SupportSelect
              label="Status"
              value={statusDraft || String(ticket.status || "open")}
              options={TICKET_STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s] || s.replace(/_/g, " ") }))}
              onChange={setStatusDraft}
              disabled={busy || updatingStatus}
            />
            {statusDraft !== String(ticket.status || "open") ? (
              <PrimaryButton title="Update Status" loading={updatingStatus} onPress={() => void handleUpdateStatus()} />
            ) : null}
            {(ticket.status === "resolved" || ticket.status === "closed") ? (
              <PrimaryButton
                title="Reopen"
                variant="outline"
                loading={busy}
                onPress={() => void post(`/support/tickets/${id}/reopen`, {})}
              />
            ) : null}
          </Card>

          <TicketInformationCard ticket={ticket} agentName={agentName} />
          <ReporterCard ticket={ticket} />
          <BookingInfoCard ticket={ticket} />

          <Card style={{ gap: 8 }}>
            <AppText variant="h3">Issue Details</AppText>
            <AppText style={{ lineHeight: 22 }}>{String(ticket.description || "—")}</AppText>
            {ticket.expected_resolution ? (
              <AppText variant="small">Expected resolution: {String(ticket.expected_resolution)}</AppText>
            ) : null}
            {ticket.additional_info ? (
              <AppText variant="small">Additional: {String(ticket.additional_info)}</AppText>
            ) : null}
            {ticket.resolution ? (
              <View style={{ marginTop: 8, gap: 4 }}>
                <AppText variant="small" style={{ fontWeight: "700" }}>
                  Resolution
                </AppText>
                <AppText variant="small">{String(ticket.resolution)}</AppText>
              </View>
            ) : null}
          </Card>

          <ConversationThread events={events} />

          {!replyDisabled ? (
            <ReplyComposer
              disabled={replyDisabled}
              sending={sendingReply}
              error={replyError}
              success={replySuccess}
              onSend={handleSendReply}
            />
          ) : (
            <AppText variant="small">This ticket is closed or resolved. Reopen it to send a new reply.</AppText>
          )}

          <PrimaryButton
            title={showWorkspace ? "Hide Workspace" : "Open Workspace"}
            variant="outline"
            onPress={() => setShowWorkspace((v) => !v)}
          />

          {showWorkspace ? (
            <>
              <Card style={{ gap: 10 }}>
                <AppText variant="h3">Priority & Assignment</AppText>
                <SupportSelect
                  label="Priority"
                  value={String(ticket.priority || "medium")}
                  options={SUPPORT_PRIORITIES.map((p) => ({ id: p.id, label: p.label }))}
                  onChange={(priority) => void patch({ priority })}
                />
                <SupportSelect
                  label="Assigned agent"
                  value={String(ticket.assigned_admin_id || "none")}
                  options={[
                    { id: "none", label: "Unassigned" },
                    ...agents.map((a) => ({ id: a.id, label: a.name || a.id })),
                  ]}
                  onChange={(v) => void patch(v === "none" ? { unassign: true } : { assigned_admin_id: v })}
                />
              </Card>

              <Card style={{ gap: 10 }}>
                <AppText variant="h3">Escalation</AppText>
                {ticket.escalated_to ? (
                  <AppText variant="small">
                    Escalated to {String(ticket.escalated_to_label || ticket.escalated_to)}
                    {ticket.escalation_reason ? `\n${ticket.escalation_reason}` : ""}
                  </AppText>
                ) : null}
                <SupportSelect
                  label="Escalate to"
                  value={escTo}
                  options={SUPPORT_ESCALATIONS.map((e) => ({ id: e.id, label: e.label }))}
                  onChange={setEscTo}
                />
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

              <Card style={{ gap: 10 }}>
                <AppText variant="h3">Resolution</AppText>
                <SupportSelect
                  label="Resolution type"
                  value={resType}
                  options={SUPPORT_RESOLUTIONS.map((e) => ({ id: e.id, label: e.label }))}
                  onChange={setResType}
                />
                <SupportSelect
                  label="Outcome"
                  value={outcome}
                  options={[
                    { id: "yes", label: "Resolved — Yes" },
                    { id: "partially", label: "Partially" },
                    { id: "no", label: "No" },
                  ]}
                  onChange={setOutcome}
                />
                <Field label="Resolution details" value={resDetails} onChangeText={setResDetails} multiline />
                <PrimaryButton
                  title="Mark Resolved"
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
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
