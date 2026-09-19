import { useState } from "react";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/formatDate";
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
import { useI18n } from "@/i18n/I18nProvider";
import { formatPujaTitleText } from "@bseva/locales";
import { PujaTitle } from "@/components/PujaTitle";

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
  requiresMuhurtham?: boolean;
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
  requiresMuhurtham,
  feePaise,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [apptDate, setApptDate] = useState<Date | undefined>();
  const [apptTime, setApptTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<BookingResult | null>(null);

  async function confirmBooking() {
    if (!apptDate) {
      toast.error(t("web.muhurta.needDate"));
      return;
    }
    if (!apptTime) {
      toast.error(t("web.muhurta.needTime"));
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
          ? t("web.muhurta.bookedPaid", { amount: rupees(out.fee_paise) })
          : t("web.muhurta.booked")
      );
    } catch (e: any) {
      toast.error(e.message || t("web.muhurta.bookFailed"));
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
            <p className="font-semibold text-foreground">
              {requiresMuhurtham
                ? t("web.muhurta.requiredTitle")
                : t("web.muhurta.title")}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {receipt
                ? t("web.muhurta.confirmedDescription")
                : feePaise > 0
                  ? t("web.muhurta.paidDescription", { amount: rupees(feePaise) })
                  : t("web.muhurta.freeDescription")}
            </p>
          </div>
        </div>
        {!receipt && !open && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t("web.muhurta.bookAction")}
          </Button>
        )}
      </div>

      <div className="rounded-md border border-primary/20 bg-card/80 px-3 py-2.5 text-sm space-y-1">
        <p className="font-medium text-foreground">{t("web.muhurta.benefitTitle")}</p>
        <p className="text-muted-foreground">
          {t("web.muhurta.benefitDescription")}
        </p>
      </div>

      {open && !receipt && (
        <div className="rounded-md border bg-card p-4 space-y-4">
          <div>
            <p className="font-semibold text-foreground">{t("web.muhurta.bookingTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("web.muhurta.servicePrompt", { service: formatPujaTitleText(serviceName) })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("web.muhurta.appointmentDate")} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start", !apptDate &&"text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {apptDate ? formatDisplayDate(apptDate) : t("booking.selectDate")}
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
              <Label>{t("web.muhurta.appointmentTime")} *</Label>
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
            <Label>{t("web.muhurta.notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("web.muhurta.notesPlaceholder")}
              rows={3}
            />
          </div>

          <div className="rounded-md border bg-orange-50/50 px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("web.muhurta.consultation")}</span>
              <span className="font-medium">{t("web.muhurta.guidance")}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("web.muhurta.dateTime")}</span>
              <span className="font-medium">
                {apptDate ? formatDisplayDate(apptDate) : "—"} · {apptTime || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-t pt-1 font-semibold">
              <span>{t("common.total")}</span>
              <span className="text-primary">{feePaise > 0 ? rupees(feePaise) : t("web.muhurta.free")}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void confirmBooking()} disabled={submitting}>
              {submitting
                ? t("web.muhurta.confirming")
                : feePaise > 0
                  ? t("web.muhurta.confirmPay", { amount: rupees(feePaise) })
                  : t("web.muhurta.confirmAppointment")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="rounded-md border bg-card px-4 py-3 text-sm space-y-2">
          <p className="font-semibold text-foreground">{t("web.muhurta.receipt")}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("web.muhurta.reference")}</span>
              <span className="font-medium">{receipt.consultation_number || receipt.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("booking.service")}</span>
              <span className="font-medium">
                <PujaTitle name={receipt.service_name || serviceName} />
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("web.muhurta.appointment")}</span>
              <span className="font-medium">
                {formatDisplayDate(receipt.appointment_date)} · {timeDisplay}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("common.status")}</span>
              <span className="font-medium text-green-700">{t("web.muhurta.awaitingPujari")}</span>
            </div>
            {receipt.fee_paise > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("status.paid")}</span>
                <span className="font-medium">{rupees(receipt.fee_paise)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t">
            {t("web.muhurta.receiptNote")}
          </p>
        </div>
      )}
    </div>
  );
}
