import { useEffect, useState } from "react";
import { History, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, rupees } from "@/lib/api";
import { isCalendarDayDisabled } from "@/lib/bookingLeadTime";
import { formatDisplayDateTime, formatDisplaySlot } from "@/lib/formatDate";
import { format } from "date-fns";
import { toast } from "sonner";

type HistoryRow = {
  sequence: number;
  old_date: string;
  old_start_time: string;
  new_date: string;
  new_start_time: string;
  fee_paise: number;
  initiated_by_name: string;
  previous_pujari_name?: string | null;
  previous_pujari_rating?: number | null;
  created_at: string;
};

type Summary = {
  eligible: boolean;
  blocked_message?: string | null;
  cutoff_hours: number;
  deadline: string;
  next_fee_paise: number;
  lead_hours: number;
  reschedule_count: number;
  pujari_performance?: {
    name: string;
    completed_pujas: number;
    rating: { average: number | null; count: number };
  } | null;
  history: HistoryRow[];
};

const slot = (date: string, time: string) => formatDisplaySlot(date, time.slice(0, 5));

export default function RescheduleCard({
  bookingId,
  customerTimezone,
  virtual,
  onChanged,
}: {
  bookingId: string;
  customerTimezone?: string | null;
  virtual: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [info, setInfo] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  async function load() {
    setInfo(await api<Summary>(`/bookings/${bookingId}/reschedule`));
  }

  useEffect(() => {
    load().catch(() => setInfo(null));
  }, [bookingId]);

  async function save() {
    if (!date) {
      toast.error("Choose a new date");
      return;
    }
    setSaving(true);
    try {
      await api(`/bookings/${bookingId}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ new_date: format(date, "yyyy-MM-dd"), new_start_time: time }),
      });
      toast.success("Puja rescheduled. We are finding a pujari for the new time.");
      setOpen(false);
      setDate(undefined);
      await Promise.all([load(), onChanged()]);
    } catch (e: any) {
      toast.error(e.message);
      await load().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  if (!info) return null;
  const performance = info.pujari_performance;
  const rating = performance?.rating;

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-primary" aria-hidden /> Reschedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Rescheduled {info.reschedule_count} time{info.reschedule_count === 1 ? "" : "s"}</p>
            <p className="text-muted-foreground">
              {info.eligible
                ? `Available until ${formatDisplayDateTime(info.deadline)}. ${info.next_fee_paise ? `Fee: ${rupees(info.next_fee_paise)}` : "Free of charge"}.`
                : info.blocked_message}
            </p>
          </div>
          {info.eligible ? <Button onClick={() => setOpen(true)}>Reschedule Puja</Button> : null}
        </div>

        {performance ? (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="font-medium">{performance.name}</p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <Star className="size-3.5 fill-[#D4AF37] text-[#D4AF37]" aria-hidden />
              {(rating?.average ?? 0).toFixed(1)}/5 ({rating?.count ?? 0}) · {performance.completed_pujas} pujas completed
            </p>
          </div>
        ) : null}

        {info.history.length ? (
          <div className="space-y-2">
            <p className="font-medium">History</p>
            {info.history.map((row) => (
              <div key={row.sequence} className="rounded-lg border p-3">
                <p className="font-medium">
                  #{row.sequence}: {slot(row.old_date, row.old_start_time)} → {slot(row.new_date, row.new_start_time)}
                </p>
                <p className="text-muted-foreground">
                  {formatDisplayDateTime(row.created_at)} · by {row.initiated_by_name} ·{" "}
                  {row.fee_paise ? `Fee ${rupees(row.fee_paise)}` : "Free"}
                </p>
                {row.previous_pujari_name ? (
                  <p className="text-muted-foreground">
                    Pujari at that time: {row.previous_pujari_name}
                    {row.previous_pujari_rating != null ? ` (${row.previous_pujari_rating.toFixed(1)}/5)` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Puja</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your booking and payment stay the same. The current pujari is released and the puja goes out to available
              pujaris for the new time. Rescheduling {info.next_fee_paise ? `costs ${rupees(info.next_fee_paise)}` : "is free"}.
            </p>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(day) => isCalendarDayDisabled(day, info.lead_hours)}
              className="mx-auto rounded-md border"
            />
            <div className="space-y-1">
              <Label htmlFor="reschedule-time">
                New start time{virtual && customerTimezone ? ` (${customerTimezone})` : ""}
              </Label>
              <Input id="reschedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || !date || !time}>
              {saving ? "Saving…" : "Confirm new time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
