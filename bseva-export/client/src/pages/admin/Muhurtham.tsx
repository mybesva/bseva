import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { PujaTitle } from "@/components/PujaTitle";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { notifyBadgesChanged } from "@/components/NotificationBell";
import { api, rupees } from "@/lib/api";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { toast } from "sonner";

type ConsultationStatus = "requested" | "in_progress" | "guided" | "completed" | "cancelled";

type Consultation = {
  id: string;
  consultation_number?: string;
  service_name?: string;
  customer_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  preferred_dates?: string[] | string | null;
  fee_paise?: number;
  payment_status?: string;
  status: ConsultationStatus;
  guidance_notes?: string | null;
  linked_booking_id?: string | null;
  pujari_id?: string | null;
  created_at?: string;
};

const STATUSES: ConsultationStatus[] = [
  "requested",
  "in_progress",
  "guided",
  "completed",
  "cancelled",
];

function preferredDates(value: Consultation["preferred_dates"]) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [value];
  }
}

export default function Muhurtham() {
  const [rows, setRows] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("actionable");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Consultation | null>(null);
  const [status, setStatus] = useState<ConsultationStatus>("requested");
  const [notes, setNotes] = useState("");
  const [linkedBookingId, setLinkedBookingId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Consultation[]>("/muhurta-consultations"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Muhurtham consultations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "actionable" && !["requested", "in_progress"].includes(row.status)) return false;
      if (filter !== "all" && filter !== "actionable" && row.status !== filter) return false;
      if (!q) return true;
      return [row.consultation_number, row.customer_name, row.service_name, row.linked_booking_id]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [filter, query, rows]);

  function openEditor(row: Consultation) {
    setEditing(row);
    setStatus(row.status);
    setNotes(row.guidance_notes || "");
    setLinkedBookingId(row.linked_booking_id || "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const params = new URLSearchParams({ status, guidance_notes: notes });
      const linked = linkedBookingId.trim();
      if (linked && linked !== editing.linked_booking_id) params.set("linked_booking_id", linked);
      await api(`/muhurta-consultations/${editing.id}?${params}`, { method: "PATCH" });
      toast.success("Muhurtham consultation updated");
      setEditing(null);
      notifyBadgesChanged();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update consultation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Muhurtham"
        description="Manage Muhurtham consultation requests independently from in-person and Virtual Puja booking queues."
        actions={
          <div className="text-sm text-muted-foreground">
            {visibleRows.length} {visibleRows.length === 1 ? "consultation" : "consultations"}
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[210px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="actionable">Action required</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((item) => (
              <SelectItem key={item} value={item}>{item.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="max-w-lg"
          placeholder="Search consultation, customer, service, booking"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Table containerClassName="max-h-[calc(100vh-14rem)] overflow-auto rounded-lg border bg-card">
          <TableHeader>
            <TableRow>
              <TableHead>Consultation</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Appointment</TableHead>
              <TableHead>Preferred dates</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.consultation_number || row.id.slice(0, 8)}</TableCell>
                <TableCell>{row.customer_name || "—"}</TableCell>
                <TableCell>{row.service_name ? <PujaTitle name={row.service_name} as="span" /> : "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.appointment_date ? formatDisplayDate(row.appointment_date) : "—"}{" "}
                  {row.appointment_time?.slice(0, 5) || ""}
                </TableCell>
                <TableCell>{preferredDates(row.preferred_dates).map((date) => formatDisplayDate(date)).join(", ") || "—"}</TableCell>
                <TableCell>
                  <div>{rupees(row.fee_paise || 0)}</div>
                  <div className="text-xs text-muted-foreground">{row.payment_status || "—"}</div>
                </TableCell>
                <TableCell><Badge variant={row.status === "cancelled" ? "destructive" : "secondary"}>{row.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="whitespace-nowrap">{formatDisplayDateTime(row.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEditor(row)}>Manage</Button>
                </TableCell>
              </TableRow>
            ))}
            {!visibleRows.length ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No Muhurtham consultations match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage {editing?.consultation_number || "consultation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ConsultationStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>{item.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Guidance notes</Label>
              <Textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record Muhurtham guidance and follow-up details." />
            </div>
            <div className="space-y-1">
              <Label>Linked booking ID (optional)</Label>
              <Input value={linkedBookingId} onChange={(event) => setLinkedBookingId(event.target.value)} placeholder="Booking UUID" />
              <p className="text-xs text-muted-foreground">Link the booking created after guidance. Existing links are preserved unless changed.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
