import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/account/OtpParts";
import { apiErrorInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_MIN,
  REPORT_REASONS,
  submitReport,
  type ReportTargetType,
} from "@/lib/compliance";

type Target = { type: ReportTargetType; id: string; title: string };

function ReportDialog({
  target,
  bookingId,
  onClose,
}: {
  target: Target | null;
  bookingId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const trimmed = details.trim();
  const detailsOk = trimmed.length >= REPORT_DETAILS_MIN && trimmed.length <= REPORT_DETAILS_MAX;

  function close() {
    setReason("");
    setDetails("");
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    if (!detailsOk) {
      setError(`Describe what happened (${REPORT_DETAILS_MIN} to ${REPORT_DETAILS_MAX} characters).`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await submitReport({
        target_type: target.type,
        target_id: target.id,
        booking_id: bookingId,
        reason,
        details: trimmed,
      });
      toast.success("Thank you. Your report was sent to the B-Seva team for review.");
      close();
    } catch (err) {
      setError(apiErrorInfo(err, "Could not send your report. Please try again.").message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target?.title}</DialogTitle>
          <DialogDescription>
            Reports are private. Our team reviews every report and may contact you for more details.
          </DialogDescription>
        </DialogHeader>
        <form id="report-form" className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">What happened?</Label>
            <Textarea
              id="report-details"
              rows={5}
              value={details}
              maxLength={REPORT_DETAILS_MAX}
              onChange={(e) => setDetails(e.target.value.slice(0, REPORT_DETAILS_MAX))}
              placeholder="Please describe the problem."
              required
            />
            <p
              className={cn(
                "text-right text-xs",
                trimmed.length > 0 && !detailsOk ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {trimmed.length}/{REPORT_DETAILS_MAX}
              {trimmed.length < REPORT_DETAILS_MIN ? ` · at least ${REPORT_DETAILS_MIN} characters` : ""}
            </p>
          </div>
          <InlineError message={error} />
        </form>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="report-form" disabled={pending}>
            {pending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Report" menu on a booking detail: report the booking, or the other party on it
 * (the pujari for a customer, the customer for a pujari).
 */
export default function ReportButton({
  bookingId,
  viewer,
  counterpartId,
  className,
}: {
  bookingId: string;
  viewer: "customer" | "pujari";
  /** pujari_id (customer viewer) or customer_id (pujari viewer); hides that option when missing. */
  counterpartId?: string | null;
  className?: string;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const counterpartType: ReportTargetType = viewer === "customer" ? "pujari" : "customer";
  const counterpartLabel = viewer === "customer" ? "Report the pujari" : "Report the customer";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className={cn("print:hidden", className)}>
            <Flag className="mr-1 h-4 w-4" />
            Report
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTarget({ type: "booking", id: bookingId, title: "Report this booking" })}>
            Report this booking
          </DropdownMenuItem>
          {counterpartId ? (
            <DropdownMenuItem
              onClick={() => setTarget({ type: counterpartType, id: String(counterpartId), title: counterpartLabel })}
            >
              {counterpartLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog target={target} bookingId={bookingId} onClose={() => setTarget(null)} />
    </>
  );
}
