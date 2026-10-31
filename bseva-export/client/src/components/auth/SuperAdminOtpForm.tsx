import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeLoginOtp, resendLoginOtp, type AuthUser } from "@/lib/api";
import { toast } from "sonner";

export type LoginChallenge = { token: string; emailHint: string };

/** Second step of Super Admin sign-in. */
export default function SuperAdminOtpForm({
  challenge,
  onDone,
  onBack,
}: {
  challenge: LoginChallenge;
  onDone: (user: AuthUser) => void | Promise<void>;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const out = await completeLoginOtp(challenge.token, otp);
      await onDone(out.user);
    } catch (err: any) {
      toast.error(err?.message || "Could not verify the OTP");
      setOtp("");
      if (err?.code === "LOGIN_EXPIRED") onBack();
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    try {
      await resendLoginOtp(challenge.token);
      toast.success(`A new OTP was sent to ${challenge.emailHint}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not send the OTP");
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit} autoComplete="off">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit OTP sent to <strong>{challenge.emailHint}</strong>. It is valid for 10 minutes.
      </p>
      <div className="space-y-2">
        <Label htmlFor="login-otp">One-time password</Label>
        <Input
          id="login-otp"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending || otp.length !== 6}>
        {pending ? "Verifying…" : "Verify OTP"}
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-muted-foreground underline" onClick={onBack}>
          Back
        </button>
        <button type="button" className="text-primary underline" onClick={() => void resend()}>
          Resend OTP
        </button>
      </div>
    </form>
  );
}
