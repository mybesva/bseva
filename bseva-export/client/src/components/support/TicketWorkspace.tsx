import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import {
  CATEGORY_LABELS,
  EVENT_LABELS,
  PRIORITY_LABELS,
  REPORTER_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  priorityClass,
  statusClass,
  type SupportTicket,
} from "@/lib/supportTickets";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const ESCALATION = [
  ["senior_support", "Senior Support"],
  ["operations", "Operations"],
  ["finance", "Finance"],
  ["pujari_manager", "Pujari Manager"],
  ["technical", "Technical"],
  ["other", "Other"],
];
const RESOLUTIONS = [
  ["information_provided", "Information Provided"],
  ["booking_updated", "Booking Updated"],
  ["puja_rescheduled", "Puja Rescheduled"],
  ["pujari_reassigned", "Pujari Reassigned"],
  ["refund_initiated", "Refund Initiated"],
  ["payment_issue_resolved", "Payment Issue Resolved"],
  ["escalated", "Escalated"],
  ["other", "Other"],
];

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value ? String(value) : "—"}</div>
    </div>
  );
}

export default function TicketWorkspace({
  ticket,
  agents,
  onBack,
  onChange,
}: {
  ticket: SupportTicket;
  agents: { id: string; name?: string }[];
  onBack: () => void;
  onChange: () => void;
}) {
  const [reply, setReply] = useState("");
  const [noteKind, setNoteKind] = useState("reply");
  const [busy, setBusy] = useState(false);
  const [escTo, setEscTo] = useState("senior_support");
  const [escReason, setEscReason] = useState("");
  const [escAction, setEscAction] = useState("");
  const [resType, setResType] = useState("information_provided");
  const [resDetails, setResDetails] = useState("");
  const [outcome, setOutcome] = useState("yes");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/support/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, body: Record<string, unknown>, ok = "Saved") {
    setBusy(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast.success(ok);
      setReply("");
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const booking = ticket.booking || {};
  const events = Array.isArray(ticket.events) ? ticket.events : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={onBack}>
            <ArrowLeft size={16} className="mr-1" /> All tickets
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{ticket.ticket_number}</h2>
            <Badge className={statusClass(ticket.status)}>{ticket.status_label || STATUS_LABELS[ticket.status]}</Badge>
            <Badge className={priorityClass(ticket.priority)}>{ticket.priority_label || PRIORITY_LABELS[ticket.priority]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{ticket.subject}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TICKET_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={ticket.status === s ? "default" : "outline"}
              disabled={busy}
              onClick={() => void patch({ status: s })}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
          {(ticket.status === "resolved" || ticket.status === "closed") && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void post(`/support/tickets/${ticket.id}/reopen`, {}, "Reopened")}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket information</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3">
              <Field label="Ticket ID" value={ticket.ticket_number} />
              <Field label="Category" value={ticket.category_label || CATEGORY_LABELS[ticket.category]} />
              <Field label="Contact source" value={SOURCE_LABELS[ticket.contact_source] || ticket.contact_source} />
              <Field label="Created" value={formatDisplayDateTime(ticket.created_at)} />
              <Field label="Last activity" value={formatDisplayDateTime(ticket.last_activity_at || ticket.updated_at)} />
              <Field
                label="SLA / target"
                value={
                  ticket.sla_due_at
                    ? `${formatDisplayDateTime(ticket.sla_due_at)}${ticket.sla_hours ? ` (${ticket.sla_hours}h)` : ""}`
                    : "—"
                }
              />
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={ticket.priority || "medium"} onValueChange={(v) => void patch({ priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned agent</Label>
                <Select
                  value={ticket.assigned_admin_id || "none"}
                  onValueChange={(v) => void patch(v === "none" ? { unassign: true } : { assigned_admin_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name || a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Assigned at" value={formatDisplayDateTime(ticket.assigned_at)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{ticket.description}</p>
              {ticket.expected_resolution ? (
                <p>
                  <span className="text-muted-foreground">Expected resolution: </span>
                  {ticket.expected_resolution}
                </p>
              ) : null}
              {ticket.additional_info ? (
                <p>
                  <span className="text-muted-foreground">Additional: </span>
                  {ticket.additional_info}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversation / activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[42vh] overflow-y-auto space-y-3 pr-1">
                {events.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
                {events.map((ev: any) => (
                  <div key={ev.id} className={`rounded-md border p-3 text-sm ${ev.visibility === "internal" ? "bg-amber-50/80 border-amber-200" : ""}`}>
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {EVENT_LABELS[ev.event_type] || ev.event_type} · {ev.actor_name || ev.actor_role || "System"}
                        {ev.visibility === "internal" ? " · Internal" : ""}
                      </span>
                      <span>{formatDisplayDateTime(ev.created_at)}</span>
                    </div>
                    {ev.body ? <p className="mt-1 whitespace-pre-wrap">{ev.body}</p> : null}
                    {(ev.previous_value || ev.new_value) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {ev.previous_value || "—"} → {ev.new_value || "—"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid sm:grid-cols-[160px_1fr] gap-2">
                <Select value={noteKind} onValueChange={setNoteKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reply">Reply</SelectItem>
                    <SelectItem value="internal_note">Internal note</SelectItem>
                    <SelectItem value="call_note">Call note</SelectItem>
                    <SelectItem value="whatsapp_note">WhatsApp note</SelectItem>
                    <SelectItem value="email_note">Email note</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply or note…" />
              </div>
              <Button disabled={busy || !reply.trim()} onClick={() => void post(`/support/tickets/${ticket.id}/messages`, { body: reply.trim(), kind: noteKind }, "Posted")}>
                {noteKind === "reply" ? "Send reply" : "Add note"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reporter</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Type" value={REPORTER_LABELS[ticket.reporter_type] || ticket.reporter_type} />
              <Field label="ID" value={ticket.reporter_public_id || ticket.user_id} />
              <Field label="Name" value={ticket.reporter_name || ticket.guest_name} />
              <Field label="Phone" value={ticket.reporter_phone || ticket.guest_phone} />
              <Field label="Email" value={ticket.reporter_email || ticket.guest_email} />
              <Field label="Language" value={ticket.reporter_language} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking / Seva</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {ticket.related_booking_id ? (
                <>
                  <Field label="Booking ID" value={booking.booking_number || ticket.booking_number} />
                  <Field label="Puja / service" value={booking.service_name || ticket.service_name} />
                  <Field label="Date & time" value={`${booking.booking_date || ticket.booking_date || "—"} ${booking.start_time || ticket.start_time || ""}`} />
                  <Field label="Location" value={booking.location_label || booking.address || ticket.booking_location} />
                  <Field label="Customer" value={booking.customer_name || ticket.booking_customer_name} />
                  <Field label="Assigned pujari" value={booking.pujari_name || ticket.booking_pujari_name} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No booking linked.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escalation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ticket.escalated_to ? (
                <div className="text-sm rounded-md border border-red-200 bg-red-50 p-2">
                  Escalated to {ticket.escalated_to_label || ticket.escalated_to}
                  <div className="text-xs text-muted-foreground">{formatDisplayDateTime(ticket.escalated_at)}</div>
                  <p className="mt-1">{ticket.escalation_reason}</p>
                </div>
              ) : null}
              <Select value={escTo} onValueChange={setEscTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESCALATION.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea rows={2} placeholder="Escalation reason" value={escReason} onChange={(e) => setEscReason(e.target.value)} />
              <Input placeholder="Required action" value={escAction} onChange={(e) => setEscAction(e.target.value)} />
              <Button
                variant="outline"
                disabled={busy || escReason.trim().length < 5}
                onClick={() =>
                  void post(
                    `/support/tickets/${ticket.id}/escalate`,
                    { escalated_to: escTo, reason: escReason.trim(), required_action: escAction.trim() || undefined },
                    "Escalated",
                  )
                }
              >
                Escalate
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ticket.resolution ? (
                <div className="text-sm rounded-md border p-2">
                  <div className="font-medium">{ticket.resolution_type_label || ticket.resolution_type}</div>
                  <p>{ticket.resolution}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDisplayDateTime(ticket.resolved_at)}
                    {ticket.resolution_outcome ? ` · ${ticket.resolution_outcome}` : ""}
                    {ticket.rating ? ` · Rating ${ticket.rating}/5` : ""}
                  </div>
                  {ticket.feedback ? <p className="text-xs mt-1">{ticket.feedback}</p> : null}
                </div>
              ) : null}
              <Select value={resType} onValueChange={setResType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Resolved — Yes</SelectItem>
                  <SelectItem value="partially">Partially</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <Textarea rows={3} placeholder="Resolution details" value={resDetails} onChange={(e) => setResDetails(e.target.value)} />
              <Button
                disabled={busy || resDetails.trim().length < 5}
                onClick={() =>
                  void post(
                    `/support/tickets/${ticket.id}/resolve`,
                    { resolution_type: resType, resolution_details: resDetails.trim(), outcome },
                    "Resolved",
                  )
                }
              >
                Mark resolved
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
