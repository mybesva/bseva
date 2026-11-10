import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorInfo, rupees } from "@/lib/api";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  DEACTIVATION_MESSAGE,
  DELETION_REASONS,
  DELETION_STATE_LABELS,
  EXPLANATION_MAX,
  EXPLANATION_MIN,
  confirmDeletion,
  deletionStateClass,
  getDeletionOverview,
  isOpenDeletion,
  requestDeletionOtp,
  type DeletionOverview,
  type DeletionRequest,
} from "@/lib/compliance";
import {
  InlineError,
  InlineNotice,
  OtpCodeInput,
  ResendCodeButton,
  otpErrorMessage,
  useOtpSender,
} from "@/components/account/OtpParts";

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  pujari: "Pujari",
  head_pujari: "Head Pujari",
};

type Step = "form" | "otp" | "done";

/** Status of an existing deletion request (open or last one). */
export function DeletionRequestStatus({ request, showCancelLink = true }: { request: DeletionRequest; showCancelLink?: boolean }) {
  const open = isOpenDeletion(request);
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="font-semibold text-foreground">Deletion request</span>
        <Badge variant="outline" className={cn("font-normal", deletionStateClass(request.state))}>
          {DELETION_STATE_LABELS[request.state] || request.state}
        </Badge>
      </div>
      {request.message ? <p className="text-foreground">{request.message}</p> : null}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline">Requested: </dt>
          <dd className="inline text-foreground">{formatDisplayDateTime(request.requested_at)}</dd>
        </div>
        {open ? (
          <div>
            <dt className="inline">To be completed by: </dt>
            <dd className="inline text-foreground">{formatDisplayDate(request.deadline_at)}</dd>
          </div>
        ) : null}
        {request.cancelled_at ? (
          <div>
            <dt className="inline">Cancelled: </dt>
            <dd className="inline text-foreground">{formatDisplayDateTime(request.cancelled_at)}</dd>
          </div>
        ) : null}
        {request.completed_at ? (
          <div>
            <dt className="inline">Completed: </dt>
            <dd className="inline text-foreground">{formatDisplayDateTime(request.completed_at)}</dd>
          </div>
        ) : null}
      </dl>
      {open && showCancelLink ? (
        <p>
          Changed your mind?{" "}
          <Link href="/delete-account?cancel=1" className="font-medium text-primary underline">
            Cancel the deletion request
          </Link>{" "}
          before it is completed.
        </p>
      ) : null}
    </div>
  );
}

function Obligations({ overview }: { overview: DeletionOverview }) {
  const { obligations, account } = overview;
  const isPujari = account.role === "pujari" || account.role === "head_pujari";
  const upcoming = obligations.bookings.filter((b) => b.kind === "upcoming");
  const ongoing = obligations.bookings.filter((b) => b.kind === "ongoing");
  const unpaid = obligations.bookings.filter((b) => b.kind === "unpaid");
  const wallet = Number(obligations.wallet_balance_paise || 0);
  const settlement = Number(obligations.pending_settlement_paise || 0);
  const refunds = Number(obligations.pending_refunds || 0);
  const nothing =
    !obligations.bookings.length && !wallet && !settlement && !refunds && !obligations.blocking.length;

  if (nothing) {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
        You have no open bookings or payments on this account.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {obligations.blocking.length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">These must be resolved before your account can be finally deleted:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {obligations.blocking.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {unpaid.length ? (
        <div>
          <p className="mb-2 font-semibold text-foreground">Unpaid online bookings</p>
          <p className="mb-2 text-muted-foreground">
            Payment for these was never completed, so nothing was charged. They will be closed.
          </p>
          <ul className="space-y-2">
            {unpaid.map((b) => (
              <li key={b.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{b.service_name || "Booking"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{b.booking_number}</span>
                </div>
                <p className="text-muted-foreground">
                  {formatDisplayDate(b.booking_date)} {b.start_time || ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {upcoming.length ? (
        <div>
          <p className="mb-2 font-semibold text-foreground">
            {isPujari ? "Accepted upcoming bookings" : "Upcoming bookings"}
          </p>
          <ul className="space-y-2">
            {upcoming.map((b) => (
              <li key={b.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{b.service_name || "Booking"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{b.booking_number}</span>
                </div>
                <p className="text-muted-foreground">
                  {formatDisplayDate(b.booking_date)} {b.start_time || ""}
                </p>
                {b.action === "reassign" ? (
                  <p className="mt-1 text-foreground">
                    This booking will be released so B-Seva can assign another pujari.
                  </p>
                ) : null}
                {b.cancellation ? (
                  b.cancellation.allowed ? (
                    <p className="mt-1 text-foreground">
                      Will be cancelled under the Cancellation Policy. Refund{" "}
                      <strong>{rupees(b.cancellation.refund_paise)}</strong>, cancellation fee{" "}
                      <strong>{rupees(b.cancellation.fee_paise)}</strong>.
                    </p>
                  ) : (
                    <p className="mt-1 text-foreground">This booking cannot be cancelled now.</p>
                  )
                ) : null}
                {b.cancellation?.policy_note ? (
                  <p className="mt-1 text-xs text-muted-foreground">{b.cancellation.policy_note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ongoing.length ? (
        <div>
          <p className="mb-2 font-semibold text-foreground">Ongoing pujas</p>
          <ul className="space-y-2">
            {ongoing.map((b) => (
              <li key={b.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{b.service_name || "Booking"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{b.booking_number}</span>
                </div>
                <p className="text-muted-foreground">
                  {formatDisplayDate(b.booking_date)} {b.start_time || ""}
                </p>
                <p className="mt-1 text-foreground">This puja will be allowed to finish.</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {wallet || settlement || refunds ? (
        <div className="space-y-1 rounded-md border border-border p-3">
          <p className="mb-1 font-semibold text-foreground">Money</p>
          {wallet ? (
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {isPujari
                  ? wallet < 0
                    ? "Amount you owe B-Seva"
                    : "Amount payable to you"
                  : "Refundable wallet balance"}
              </span>
              <strong className="text-foreground">{rupees(Math.abs(wallet))}</strong>
            </p>
          ) : null}
          {settlement ? (
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground">Payouts not yet settled</span>
              <strong className="text-foreground">{rupees(settlement)}</strong>
            </p>
          ) : null}
          {refunds ? (
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground">Refunds in progress</span>
              <strong className="text-foreground">{refunds}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type DeleteAccountFlowProps = {
  /** "signed_in" verifies with an email OTP; "public" already verified the email and uses `token`. */
  mode: "signed_in" | "public";
  /** Deletion token from /account/deletion/public/verify (public mode only). */
  token?: string | null;
  /** Called after the request is confirmed (the account is deactivated). */
  onDeactivated?: () => void;
  /** Called when the user leaves the success screen. */
  onFinish: () => void;
};

export default function DeleteAccountFlow({ mode, token, onDeactivated, onFinish }: DeleteAccountFlowProps) {
  const [overview, setOverview] = useState<DeletionOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("form");
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const otp = useOtpSender();

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setOverview(await getDeletionOverview(mode === "public" ? token : undefined));
    } catch (err) {
      const info = apiErrorInfo(err, "Could not load your account details.");
      setLoadError(
        info.status === 401 && mode === "public"
          ? "Your verification has expired. Please verify your email again."
          : info.message,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);

  const reasons = overview?.reasons?.length ? overview.reasons : DELETION_REASONS;
  const trimmed = explanation.trim();
  const explanationOk = trimmed.length >= EXPLANATION_MIN && trimmed.length <= EXPLANATION_MAX;

  function validate(): boolean {
    if (!reason) {
      setFormError("Choose a reason.");
      return false;
    }
    if (!explanationOk) {
      setFormError(`Tell us a little more (${EXPLANATION_MIN} to ${EXPLANATION_MAX} characters).`);
      return false;
    }
    if (!agreed) {
      setFormError("Tick the box to confirm you understand.");
      return false;
    }
    setFormError(null);
    return true;
  }

  async function finishConfirm(body: { reason: string; explanation: string; code?: string }) {
    setPending(true);
    setFormError(null);
    try {
      await confirmDeletion(body, mode === "public" ? token : undefined);
      setStep("done");
      onDeactivated?.();
    } catch (err) {
      setFormError(otpErrorMessage(err, "Could not submit your request. Please try again."));
    } finally {
      setPending(false);
    }
  }

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (mode === "public") {
      await finishConfirm({ reason, explanation: trimmed });
      return;
    }
    const out = await otp.send(() => requestDeletionOtp(reason, trimmed));
    if (out) {
      setEmailHint(out.email_hint || overview?.account.email || "your email");
      setStep("otp");
    }
  }

  async function onConfirmOtp(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setFormError("Enter the 6-digit code from the email.");
      return;
    }
    await finishConfirm({ reason, explanation: trimmed, code });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your account…
      </div>
    );
  }

  if (loadError || !overview) {
    return (
      <div className="space-y-3">
        <InlineError message={loadError || "Could not load your account details."} />
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">{DEACTIVATION_MESSAGE}</p>
          <p className="text-xs text-muted-foreground">
            You can cancel the request before it is completed from the{" "}
            <Link href="/delete-account?cancel=1" className="text-primary underline">
              Delete Account
            </Link>{" "}
            page.
          </p>
          <Button onClick={onFinish}>Go to home</Button>
        </CardContent>
      </Card>
    );
  }

  if (isOpenDeletion(overview.request)) {
    return <DeletionRequestStatus request={overview.request} />;
  }

  return (
    <div className="space-y-5">
      {overview.request ? <DeletionRequestStatus request={overview.request} showCancelLink={false} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Before you delete your account</CardTitle>
          <CardDescription>Review what happens to your bookings and money.</CardDescription>
        </CardHeader>
        <CardContent>
          <Obligations overview={overview} />
        </CardContent>
      </Card>

      {step === "form" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delete account</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onContinue}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="del-role">Account type</Label>
                  <Input id="del-role" value={ROLE_LABELS[overview.account.role] || overview.account.role} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="del-email">Registered email</Label>
                  <Input id="del-email" value={overview.account.email} readOnly disabled />
                </div>
              </div>

              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> This will deactivate your account straight away
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>You will be signed out on all devices and cannot sign in while the request is open.</li>
                  <li>
                    {overview.account.role === "customer"
                      ? "Upcoming bookings are cancelled under the Cancellation Policy, with the fees shown above. Ongoing pujas finish first."
                      : "Your accepted upcoming bookings are released for reassignment, and you will receive no new booking offers."}
                  </li>
                  <li>Your account is deleted within 14 days. Cancelled bookings are not restored if you cancel the request.</li>
                </ul>
              </div>

              {overview.retention_notice ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
                  <p className="mb-1 font-semibold text-foreground">What we keep</p>
                  <p className="whitespace-pre-line text-muted-foreground">{overview.retention_notice}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="del-reason">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="del-reason">
                    <SelectValue placeholder="Choose a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {DELETION_REASONS.find((d) => d.key === r.key)?.label || r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="del-explanation">Tell us more</Label>
                <Textarea
                  id="del-explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value.slice(0, EXPLANATION_MAX))}
                  rows={4}
                  maxLength={EXPLANATION_MAX}
                  placeholder="Please explain why you want to delete your account."
                  required
                />
                <p
                  className={cn(
                    "text-right text-xs",
                    trimmed.length > 0 && !explanationOk ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {trimmed.length}/{EXPLANATION_MAX}
                  {trimmed.length < EXPLANATION_MIN ? ` · at least ${EXPLANATION_MIN} characters` : ""}
                </p>
              </div>

              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                <span>
                  I understand that my account will be deactivated now and deleted within 14 days, and that records
                  B-Seva must keep by law will be retained as described above.
                </span>
              </label>

              <InlineError message={formError || otp.error} />

              <Button type="submit" variant="destructive" disabled={pending || otp.sending || otp.waiting}>
                {pending || otp.sending
                  ? "Please wait…"
                  : mode === "public"
                    ? "Delete my account"
                    : otp.waiting
                      ? `Please wait ${otp.remaining} s`
                      : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === "otp" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirm with the code we emailed</CardTitle>
            <CardDescription>
              We sent a 6-digit code to <strong>{emailHint}</strong>. It is valid for 5 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onConfirmOtp} autoComplete="off">
              <OtpCodeInput id="del-code" value={code} onChange={setCode} />
              <InlineNotice message="Your account is deactivated as soon as you confirm." />
              <InlineError message={formError || otp.error} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="submit" variant="destructive" disabled={pending || code.length !== 6}>
                  {pending ? "Deleting…" : "Confirm deletion"}
                </Button>
                <ResendCodeButton
                  remaining={otp.remaining}
                  sending={otp.sending}
                  onClick={() => void otp.send(() => requestDeletionOtp(reason, trimmed))}
                />
              </div>
              <button
                type="button"
                className="text-sm text-muted-foreground underline"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setFormError(null);
                }}
              >
                Back
              </button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
