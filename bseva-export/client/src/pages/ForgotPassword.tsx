import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, KeyRound } from "lucide-react";
import Layout from "@/components/Layout";
import BSevaLogo from "@/components/BSevaLogo";
import PasswordInput from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InlineError,
  InlineNotice,
  OtpCodeInput,
  ResendCodeButton,
  otpErrorMessage,
  useOtpSender,
} from "@/components/account/OtpParts";
import { forgotPassword, resetPassword } from "@/lib/compliance";

const GENERIC_SENT = "If an account exists for this email, we have sent a code.";
const MIN_PASSWORD = 8;

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const otp = useOtpSender();

  async function sendCode() {
    const out = await otp.send(() => forgotPassword(email.trim()));
    if (out) {
      setNotice(out.message || GENERIC_SENT);
      setStep("reset");
    }
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function onResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Your new password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await resetPassword(email.trim(), code, password);
      setPassword("");
      setConfirm("");
      setCode("");
      setStep("done");
    } catch (err) {
      setError(otpErrorMessage(err, "Could not reset your password. Please try again."));
    } finally {
      setPending(false);
    }
  }

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <Layout publicOnly>
      <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-secondary/30 to-background px-4 py-16">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <div className="mb-2 flex justify-center">
              <BSevaLogo variant="full" size="lg" />
            </div>
            <CardTitle className="text-center text-2xl text-foreground">Reset your password</CardTitle>
            <CardDescription className="text-center leading-relaxed">
              {step === "email"
                ? "Enter the email address on your B-Seva account. We will email you a 6-digit code."
                : step === "reset"
                  ? "Enter the code from the email and choose a new password."
                  : "Your password has been changed."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form className="space-y-4" onSubmit={onEmailSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <InlineError message={otp.error} />
                <Button type="submit" className="w-full" disabled={otp.sending || otp.waiting || !email.trim()}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {otp.sending ? "Sending…" : otp.waiting ? `Please wait ${otp.remaining} s` : "Send code"}
                </Button>
              </form>
            ) : null}

            {step === "reset" ? (
              <form className="space-y-4" onSubmit={onResetSubmit} autoComplete="off">
                <InlineNotice message={notice} />
                <p className="text-sm text-muted-foreground">
                  Email: <strong className="text-foreground">{email}</strong>{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => {
                      setStep("email");
                      setError(null);
                    }}
                  >
                    Change
                  </button>
                </p>
                <OtpCodeInput id="fp-code" value={code} onChange={setCode} />
                <div className="space-y-2">
                  <Label htmlFor="fp-new">New password</Label>
                  <PasswordInput
                    id="fp-new"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirm">Confirm new password</Label>
                  <PasswordInput
                    id="fp-confirm"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                  />
                  {mismatch ? <p className="text-xs text-destructive">The passwords do not match.</p> : null}
                </div>
                <InlineError message={error || otp.error} />
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Saving…" : "Reset password"}
                </Button>
                <div className="flex justify-end">
                  <ResendCodeButton remaining={otp.remaining} sending={otp.sending} onClick={() => void sendCode()} />
                </div>
              </form>
            ) : null}

            {step === "done" ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  You have been signed out on all devices. Sign in with your new password.
                </p>
                <Button asChild className="w-full">
                  <Link href="/login">Back to login</Link>
                </Button>
              </div>
            ) : null}

            {step !== "done" ? (
              <p className="mt-6 text-center text-sm">
                <Link href="/login" className="text-muted-foreground hover:text-primary">
                  Back to login
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
