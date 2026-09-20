import {
  EMPTY_SUPPORT_TICKET,
  SUPPORT_CATEGORIES,
  SUPPORT_CONTACT_SOURCES,
  SUPPORT_PRIORITIES,
  SUPPORT_REPORTER_TYPES,
  TICKET_STATUSES,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Ticket = { id: string; subject?: string; status?: string; category?: string; description?: string; body?: string };
type Person = { id: string; name?: string; phone?: string; email?: string };

export default function AdminSupport() {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_SUPPORT_TICKET });
  const [dirQ, setDirQ] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [hits, setHits] = useState<Person[]>([]);
  const [bookingId, setBookingId] = useState("");
  const list = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => apiClient.listSupportTickets(),
  });
  const rows = (list.data || []) as Ticket[];

  async function searchPeople() {
    if (!dirQ.trim()) return;
    const found = await apiClient.supportDirectory(dirQ.trim(), form.reporter_type);
    setHits(found as Person[]);
  }

  async function createTicket() {
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        sla_hours: form.sla_hours ? Number(form.sla_hours) : undefined,
        assigned_admin_id: form.assigned_admin_id || undefined,
        related_booking_id: bookingId || undefined,
        user_id: person && form.reporter_type !== "temple" ? person.id : undefined,
        guest_name: form.reporter_type === "other" || form.reporter_type === "temple" ? form.guest_name || person?.name : undefined,
        guest_phone: form.reporter_type === "other" || form.reporter_type === "temple" ? form.guest_phone || person?.phone : undefined,
        guest_email: form.reporter_type === "other" || form.reporter_type === "temple" ? form.guest_email || person?.email : undefined,
      };
      await apiClient.createSupportTicket(payload);
      setForm({ ...EMPTY_SUPPORT_TICKET });
      setPerson(null);
      setBookingId("");
      await list.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.support")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card style={{ gap: 8 }}>
          <AppText variant="h3">Create ticket</AppText>
          <AppText variant="small">Reported by</AppText>
          <ChoiceChips
            options={SUPPORT_REPORTER_TYPES.map((o) => ({ id: o.id, label: o.label }))}
            value={form.reporter_type}
            onChange={(v) => {
              setForm({ ...form, reporter_type: String(v) });
              setPerson(null);
              setHits([]);
            }}
          />
          <Field label="Find person" value={dirQ} onChangeText={setDirQ} />
          <PrimaryButton title="Search directory" variant="outline" onPress={() => void searchPeople()} />
          {hits.map((h) => (
            <PrimaryButton
              key={h.id}
              title={`${h.name || h.id} · ${h.phone || h.email || ""}`}
              variant={person?.id === h.id ? "primary" : "outline"}
              onPress={() => setPerson(h)}
            />
          ))}
          <Field label="Subject *" value={form.subject} onChangeText={(subject) => setForm({ ...form, subject })} />
          <Field label="Description *" value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline />
          <ChoiceChips
            options={SUPPORT_CATEGORIES.map((o) => ({ id: o.id, label: o.label }))}
            value={form.category}
            onChange={(v) => setForm({ ...form, category: String(v) })}
          />
          <ChoiceChips
            options={SUPPORT_PRIORITIES.map((o) => ({ id: o.id, label: o.label }))}
            value={form.priority}
            onChange={(v) => setForm({ ...form, priority: String(v) })}
          />
          <ChoiceChips
            options={SUPPORT_CONTACT_SOURCES.map((o) => ({ id: o.id, label: o.label }))}
            value={form.contact_source}
            onChange={(v) => setForm({ ...form, contact_source: String(v) })}
          />
          <Field label="Expected resolution" value={form.expected_resolution} onChangeText={(expected_resolution) => setForm({ ...form, expected_resolution })} />
          <Field label="Additional info" value={form.additional_info} onChangeText={(additional_info) => setForm({ ...form, additional_info })} />
          <Field label="SLA hours" value={form.sla_hours} onChangeText={(sla_hours) => setForm({ ...form, sla_hours })} keyboardType="number-pad" />
          <Field label="Related booking ID" value={bookingId} onChangeText={setBookingId} />
          {(form.reporter_type === "other" || form.reporter_type === "temple") ? (
            <>
              <Field label="Guest name" value={form.guest_name} onChangeText={(guest_name) => setForm({ ...form, guest_name })} />
              <Field label="Guest phone" value={form.guest_phone} onChangeText={(guest_phone) => setForm({ ...form, guest_phone })} />
              <Field label="Guest email" value={form.guest_email} onChangeText={(guest_email) => setForm({ ...form, guest_email })} />
            </>
          ) : null}
          <PrimaryButton title="Create ticket" loading={creating} onPress={() => void createTicket()} />
        </Card>
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((ticket) => (
          <Card key={ticket.id}>
            <StatusBadge status={String(ticket.status || "open")} />
            <AppText variant="h3">{ticket.subject}</AppText>
            <AppText variant="small">{ticket.category}</AppText>
            <AppText variant="small">{ticket.description || ticket.body}</AppText>
            <ChoiceChips
              options={TICKET_STATUSES.map((id) => ({ id, label: id.replace(/_/g, " ") }))}
              value={status || String(ticket.status || "open")}
              onChange={(v) => setStatus(String(v))}
            />
            <PrimaryButton
              title="Update status"
              variant="outline"
              onPress={async () => {
                setError(null);
                try {
                  await apiClient.api(`/support/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ status: status || ticket.status }) });
                  await list.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
            <Field label="Reply" value={reply} onChangeText={setReply} />
            <PrimaryButton
              title="Send reply"
              variant="outline"
              onPress={async () => {
                if (!reply.trim()) return;
                setError(null);
                try {
                  await apiClient.replySupportTicket(ticket.id, reply.trim(), "agent");
                  setReply("");
                  await list.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
