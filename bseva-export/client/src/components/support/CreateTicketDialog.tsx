import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { CATEGORY_LABELS, SOURCE_LABELS } from "@/lib/supportTickets";
import { toast } from "sonner";

type Person = {
  id: string;
  public_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  preferred_language?: string;
  city?: string;
};

type Booking = {
  id: string;
  booking_number?: string;
  service_name?: string;
  booking_date?: string;
  start_time?: string;
  location_label?: string;
  customer_name?: string;
  pujari_name?: string;
};

const EMPTY = {
  reporter_type: "customer",
  contact_source: "phone",
  subject: "",
  category: "other",
  priority: "medium",
  description: "",
  expected_resolution: "",
  additional_info: "",
  assigned_admin_id: "",
  sla_hours: "",
  guest_name: "",
  guest_phone: "",
  guest_email: "",
};

export default function CreateTicketDialog({
  open,
  onOpenChange,
  agents,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agents: { id: string; name?: string }[];
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setPerson(null);
      setHits([]);
      setQ("");
      setBookings([]);
      setBookingId("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !q.trim() || form.reporter_type === "other") {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void api<Person[]>(
        `/support/tickets/directory?q=${encodeURIComponent(q.trim())}&kind=${form.reporter_type}`,
      )
        .then(setHits)
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, form.reporter_type, open]);

  useEffect(() => {
    if (!person?.id || form.reporter_type === "temple" || form.reporter_type === "other") {
      setBookings([]);
      return;
    }
    void api<Booking[]>(`/support/tickets/directory/${person.id}/bookings`)
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [person?.id, form.reporter_type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
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
      const created = await api<{ id: string; ticket_number: string }>("/support/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`Ticket ${created.ticket_number} created`);
      onOpenChange(false);
      onCreated(created.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedBooking = bookings.find((b) => b.id === bookingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create support ticket</DialogTitle>
        </DialogHeader>
        <form id="create-ticket-form" className="space-y-4" onSubmit={submit}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Reported by</Label>
              <Select
                value={form.reporter_type}
                onValueChange={(v) => {
                  setForm({ ...form, reporter_type: v });
                  setPerson(null);
                  setQ("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="pujari">Pujari</SelectItem>
                  <SelectItem value="temple">Temple</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contact source</Label>
              <Select value={form.contact_source} onValueChange={(v) => setForm({ ...form, contact_source: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.reporter_type !== "other" && (
            <div className="space-y-1">
              <Label>Search {form.reporter_type} by ID, name, phone or email</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" />
              {hits.length > 0 && (
                <div className="rounded-md border max-h-40 overflow-y-auto">
                  {hits.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setPerson(h);
                        setQ(h.name || h.public_id || "");
                        setHits([]);
                        if (form.reporter_type === "temple") {
                          setForm({
                            ...form,
                            guest_name: h.name || "",
                            guest_phone: h.phone || "",
                            guest_email: h.email || "",
                          });
                        }
                      }}
                    >
                      <div className="font-medium">{h.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.public_id || h.id} · {h.phone || "—"} · {h.email || "—"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {person && form.reporter_type !== "temple" && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm grid sm:grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">ID</span>
                <div className="font-medium">{person.public_id || person.id}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Name</span>
                <div className="font-medium">{person.name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Phone</span>
                <div>{person.phone || "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Email</span>
                <div>{person.email || "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Language</span>
                <div>{person.preferred_language || "—"}</div>
              </div>
            </div>
          )}

          {(form.reporter_type === "other" || form.reporter_type === "temple") && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} />
              </div>
            </div>
          )}

          {bookings.length > 0 && (
            <div className="space-y-1">
              <Label>Related booking</Label>
              <Select value={bookingId || "none"} onValueChange={(v) => setBookingId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.booking_number} · {b.service_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBooking && (
                <p className="text-xs text-muted-foreground">
                  {selectedBooking.booking_date} {selectedBooking.start_time || ""} · {selectedBooking.location_label || "—"}
                  {selectedBooking.pujari_name ? ` · Pujari ${selectedBooking.pujari_name}` : ""}
                </p>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required minLength={5} />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assign agent</Label>
              <Select value={form.assigned_admin_id || "none"} onValueChange={(v) => setForm({ ...form, assigned_admin_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
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
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={4} required minLength={10} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Expected resolution</Label>
              <Textarea rows={2} value={form.expected_resolution} onChange={(e) => setForm({ ...form, expected_resolution: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Additional information</Label>
              <Textarea rows={2} value={form.additional_info} onChange={(e) => setForm({ ...form, additional_info: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1 max-w-[160px]">
            <Label>SLA hours</Label>
            <Input type="number" min={1} max={720} value={form.sla_hours} onChange={(e) => setForm({ ...form, sla_hours: e.target.value })} placeholder="Auto" />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-ticket-form" disabled={saving}>
            {saving ? "Creating…" : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
