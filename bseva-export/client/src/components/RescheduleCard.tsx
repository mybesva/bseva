import { useEffect, useState } from "react";
import { CheckCircle2, History, Star, Wallet } from "lucide-react";
import { useLocation } from "wouter";
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
  wallet_balance_paise: number;
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
  const [, setLocation] = useLocation();
  const [info, setInfo] = useState<Summary | null>(null);
  const [step, setStep] = useState<"closed" | "slot" | "pay" | "done">("closed");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  async function load() {
    setInfo(await api<Summary>(`/bookings/${bookingId}/reschedule`));
  }

  useEffect(() => {
    load().catch(() => setInfo(null));
  }, [bookingId]);

  async function save() {
    if (!date || !info) {
      toast.error("Choose a new date");
      return;
    }
    const fee = info.next_fee_paise;
    setSaving(true);
    try {
      await api(`/bookings/${bookingId}/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          new_date: format(date, "yyyy-MM-dd"),
          new_start_time: time,
          expected_fee_paise: fee,
        }),
      });
      setDoneMessage(
        fee
          ? `${rupees(fee)} was paid from your wallet. We are finding a pujari for the new time.`
          : "Your puja was rescheduled free of cost. We are finding a pujari for the new time.",
      );
      setStep("done");
      setDate(undefined);
      await Promise.all([load(), onChanged()]);
    } catch (e: any) {
      toast.error(e.message);
      await load().catch(() => undefined);
      setStep("pay");
    } finally {
      setSaving(false);
    }
  }

  if (!info) return null;
  const performance = info.pujari_performance;
  const rating = performance?.rating;
  const fee = info.next_fee_paise;
  const shortfall = Math.max(0, fee - info.wallet_balance_paise);

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
              {info.eligible ? `Available until ${formatDisplayDateTime(info.deadline)}.` : info.blocked_message}
            </p>
            {info.eligible ? (
              <p className="font-medium">
                Rescheduling Charge: {rupees(fee)}
                {fee ? "" : " (Free)"}
              </p>
            ) : null}
          </div>
          {info.eligible ? <Button onClick={() => setStep("slot")}>Reschedule Puja</Button> : null}
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

      <Dialog open={step !== "closed"} onOpenChange={(next) => !next && !saving && setStep("closed")}>
        <DialogContent>
          {step === "slot" ? (
            <>
              <DialogHeader>
                <DialogTitle>Reschedule Puja</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your booking and payment stay the same. The current pujari is released and the puja goes out to
                  available pujaris for the new time.
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
                <Button variant="outline" onClick={() => setStep("closed")}>
                  Cancel
                </Button>
                <Button onClick={() => setStep("pay")} disabled={!date || !time}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {step === "pay" && date ? (
            <>
              <DialogHeader>
                <DialogTitle>{fee ? "Pay Rescheduling Charge" : "Free Rescheduling"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">New Time</span>
                  <span className="font-medium">{slot(format(date, "yyyy-MM-dd"), time)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Rescheduling Charge</span>
                  <span className="font-medium">{rupees(fee)}</span>
                </div>
                {fee ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Wallet Balance</span>
                    <span className="font-medium">{rupees(info.wallet_balance_paise)}</span>
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted/50 p-3">This reschedule is free of cost. Nothing will be charged.</p>
                )}
                {shortfall ? (
                  <p className="rounded-lg bg-muted/50 p-3">
                    Your wallet is {rupees(shortfall)} short. Add money to your wallet, then reschedule again.
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={saving} onClick={() => setStep("slot")}>
                  Back
                </Button>
                {shortfall ? (
                  <Button onClick={() => setLocation("/customer/wallet")}>Add Money to Wallet</Button>
                ) : (
                  <Button onClick={() => void save()} disabled={saving}>
                    {saving ? (
                      "Saving…"
                    ) : fee ? (
                      <>
                        <Wallet className="size-4" aria-hidden /> Pay {rupees(fee)} from Wallet
                      </>
                    ) : (
                      "Confirm Free Reschedule"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}

          {step === "done" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> Puja Rescheduled
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{doneMessage}</p>
              <DialogFooter>
                <Button onClick={() => setStep("closed")}>OK</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
