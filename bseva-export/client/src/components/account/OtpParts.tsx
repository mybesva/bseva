import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorInfo } from "@/lib/api";
import { formatWait, useCountdown } from "@/hooks/useCountdown";

/** Server resend gap for email OTPs (api-contract: 60 seconds). */
export const OTP_RESEND_SECONDS = 60;

export const INVALID_CODE_MESSAGE = "The code is incorrect or has expired. Check the latest email or request a new code.";

/** Friendly text for an error from an OTP verify call. */
export function otpErrorMessage(err: unknown, fallback = "Could not verify the code. Please try again.") {
  const info = apiErrorInfo(err, fallback);
  if (info.code === "INVALID_CODE") return INVALID_CODE_MESSAGE;
  if (info.status === 429) {
    return info.retryAfterSeconds
      ? `Too many attempts. Please try again in ${formatWait(info.retryAfterSeconds)}.`
      : "Too many attempts. Please try again later.";
  }
  return info.message;
}

/**
 * Sends an OTP and runs the resend countdown. A 429 starts the countdown from the server's
 * retry time and returns the message to show.
 */
export function useOtpSender() {
  const countdown = useCountdown();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send<T extends { message?: string }>(fn: () => Promise<T>): Promise<T | null> {
    if (countdown.active || sending) return null;
    setSending(true);
    setError(null);
    try {
      const out = await fn();
      countdown.start(OTP_RESEND_SECONDS);
      return out;
    } catch (err) {
      const info = apiErrorInfo(err, "Could not send the code. Please try again.");
      if (info.status === 429) {
        const wait = info.retryAfterSeconds ?? OTP_RESEND_SECONDS;
        countdown.start(wait);
        setError(`Too many requests. Please try again in ${formatWait(wait)}.`);
      } else {
        setError(info.message);
      }
      return null;
    } finally {
      setSending(false);
    }
  }

  return { send, sending, error, setError, remaining: countdown.remaining, waiting: countdown.active };
}

export function OtpCodeInput({
  id,
  value,
  onChange,
  label = "Verification code",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        maxLength={6}
        required
      />
    </div>
  );
}

export function ResendCodeButton({
  remaining,
  sending,
  onClick,
}: {
  remaining: number;
  sending: boolean;
  onClick: () => void;
}) {
  const disabled = sending || remaining > 0;
  return (
    <button
      type="button"
      className="text-sm text-primary underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      disabled={disabled}
      onClick={onClick}
    >
      {sending ? "Sending…" : remaining > 0 ? `Resend code in ${formatWait(remaining)}` : "Resend code"}
    </button>
  );
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
      {message}
    </p>
  );
}

export function InlineNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
      {message}
    </p>
  );
}
