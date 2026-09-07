import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, rupees } from "@/lib/api";
import { cn } from "@/lib/utils";

type BookingResult = {
  id: string;
  consultation_number?: string;
  fee_paise: number;
  payment_status: string;
  appointment_date: string;
  appointment_time: string;
  service_name?: string;
};

type Props = {
  serviceId: string;
  serviceName: string;
  requiresMuhurta?: boolean;
  feePaise: number;
};

const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

export default function MuhurtaConsultationBook({
  serviceId,
  serviceName,
  requiresMuhurta,
  feePaise,
}: Props) {
  const [open, setOpen] = useState(false);
  const [apptDate, setApptDate] = useState<Date | undefined>();
  const [apptTime, setApptTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<BookingResult | null>(null);

  async function confirmBooking() {
    if (!apptDate) {
      toast.error("Please select an appointment date");
      return;
    }
    if (!apptTime) {
      toast.error("Please select an appointment time");
      return;
    }
    setSubmitting(true);
    try {
      const out = await api<BookingResult>("/muhurta-consultations", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          appointment_date: format(apptDate, "yyyy-MM-dd"),
          appointment_time: apptTime,
          preferred_dates: [format(apptDate, "yyyy-MM-dd")],
          notes: notes.trim() || undefined,
        }),
      });
      setReceipt(out);
      setOpen(false);
      toast.success(
        out.payment_status === "paid"
          ? `Muhurta consultation booked. ${rupees(out.fee_paise)} debited.`
          : "Muhurta consultation booked successfully."
      );
    } catch (e: any) {
      toast.error(e.message || "Could not book consultation");
    } finally {
      setSubmitting(false);
    }
  }

  const timeDisplay = (receipt?.appointment_time || apptTime || "").slice(0, 5);

  return (
    <div className="mt-6 rounded-lg border border-primary/30 bg-orange-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Sparkles className="text-primary mt-0.5 shrink-0" size={20} />
          <div className="min-w-0">
            <p className="font-heading font-semibold text-sidebar">
              {requiresMuhurta
                ? "This puja needs an auspicious time (muhurta)"
                : "Book a muhurta consultation"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {receipt
                ? "Your muhurta consultation appointment is confirmed. A pujari will join at the selected time and share recommended dates for this puja."
                : feePaise > 0
                  ? `Book an appointment with a pujari for ${rupees(feePaise)} (wallet). Choose date and time below — same flow as a normal booking.`
                  : "Book an appointment with a pujari. Choose date and time — same flow as a normal booking."}
            </p>
          </div>
        </div>
        {!receipt && !open && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Book muhurta consultation
          </Button>
        )}
      </div>

      <div className="rounded-md border border-primary/20 bg-white/80 px-3 py-2.5 text-sm space-y-1">
        <p className="font-medium text-sidebar">B-Seva benefit</p>
        <p className="text-muted-foreground">
          If you set your muhurtham through B-Seva, you get a discount when you book marriage /
          wedding services with us. Your consultation fee stays as a paid receipt on your account.
        </p>
      </div>

      {open && !receipt && (
        <div className="rounded-md border bg-white p-4 space-y-4">
          <div>
            <p className="font-heading font-semibold text-[#1E3A5F]">Muhurta consultation booking</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Service: {serviceName} · Select your appointment date and time
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Appointment date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start", !apptDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {apptDate ? format(apptDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={apptDate}
                    onSelect={setApptDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Appointment time *</Label>
              <Input
                type="time"
                value={apptTime}
                onChange={(e) => setApptTime(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setApptTime(slot)}
                    className={cn(
                      "text-xs px-2 py-1 rounded border",
                      apptTime === slot
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 hover:bg-muted"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes for pujari (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Marriage muhurtham for April, family in Hyderabad…"
              rows={3}
            />
          </div>

          <div className="rounded-md border bg-orange-50/50 px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Consultation</span>
              <span className="font-medium">Muhurta guidance</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Date & time</span>
              <span className="font-medium">
                {apptDate ? format(apptDate, "PPP") : "—"} · {apptTime || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="text-[#F7931E]">{feePaise > 0 ? rupees(feePaise) : "Free"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void confirmBooking()} disabled={submitting}>
              {submitting
                ? "Confirming…"
                : feePaise > 0
                  ? `Confirm & pay ${rupees(feePaise)}`
                  : "Confirm appointment"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="rounded-md border bg-white px-4 py-3 text-sm space-y-2">
          <p className="font-heading font-semibold text-[#1E3A5F]">Consultation receipt</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-medium">{receipt.consultation_number || receipt.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{receipt.service_name || serviceName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Appointment</span>
              <span className="font-medium">
                {format(new Date(receipt.appointment_date + "T12:00:00"), "PPP")} · {timeDisplay}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-green-700">Booked · awaiting pujari</span>
            </div>
            {receipt.fee_paise > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium">{rupees(receipt.fee_paise)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t">
            Keep this receipt — it counts toward your marriage-service discount when you book with
            B-Seva. You can still complete the main puja booking below after guidance.
          </p>
        </div>
      )}
    </div>
  );
}
