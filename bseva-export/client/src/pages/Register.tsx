import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordInput, { passwordStrengthOk } from "@/components/PasswordInput";
import { LegalInlineLink } from "@/components/LegalModal";
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { api, apiBase, registerApi } from "@/lib/api";
import { REGISTRATION_CONSENT_LABEL, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { useI18n } from "@/i18n/I18nProvider";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Register() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const roleHint = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("role");
  const [accountType, setAccountType] = useState<"customer" | "pujari">(roleHint === "pujari" ? "pujari" : "customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requestedLevel, setRequestedLevel] = useState(2);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const { levels: pujariLevels } = usePujariLevels();

  async function sendOtp() {
    if (!phone && !email) {
      toast.error("Enter phone or email first");
      return;
    }
    try {
      await api("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone, email, purpose: "register" }),
      });
      setOtpSent(true);
      toast.success("Verification code sent");
    } catch (err: any) {
      toast.error(err.message || "Could not send OTP");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Password and confirmation do not match");
      return;
    }
    if (!passwordStrengthOk(password)) {
      toast.error("Password must be at least 8 characters and include letters and numbers");
      return;
    }
    if (!consent) {
      toast.error("You must accept the Terms & Conditions and Privacy Policy");
      return;
    }
    if (!otp.trim()) {
      toast.error("Enter the verification code sent to your phone or email");
      return;
    }
    setPending(true);
    try {
      await registerApi({
        account_type: accountType,
        name,
        email,
        phone,
        password,
        otp,
        language: "en",
        calendar_preference: "north",
        requested_level: accountType === "pujari" ? requestedLevel : undefined,
        registration_consent: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      });
      toast.success(`Welcome, ${name}. You can add your address after signing in.`);
      setLocation(accountType === "pujari" ? "/pujari/onboarding" : "/customer/address");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-[70vh] py-12 px-4">
        <Card className="w-full max-w-lg mx-auto border-border shadow-lg">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Create your BSeva account</CardTitle>
            <CardDescription>
              Register as Customer or Pujari. Address and location can be added after you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit} autoComplete="off">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={accountType === "customer" ? "default" : "outline"} onClick={() => setAccountType("customer")}>Customer</Button>
                <Button type="button" variant={accountType === "pujari" ? "default" : "outline"} onClick={() => setAccountType("pujari")}>Pujari</Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" name="bseva-reg-name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" name="bseva-reg-email" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="off" name="bseva-reg-phone" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                </div>
              </div>
              {accountType === "pujari" && (
                <div className="space-y-2">
                  <Label>{t("pujari.level.title")}</Label>
                  <select className="w-full h-10 rounded-md border px-2 text-sm" value={requestedLevel} onChange={(e) => setRequestedLevel(Number(e.target.value))}>
                    {pujariLevels.map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        Level {lvl.level} — {lvl.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Verification code</Label>
                <div className="flex gap-2">
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" required />
                  <Button type="button" variant="secondary" onClick={() => void sendOtp()}>{otpSent ? "Resend" : "Send OTP"}</Button>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <span>
                  {REGISTRATION_CONSENT_LABEL}{" "}
                  <LegalInlineLink kind="terms">Terms & Conditions</LegalInlineLink>{" "}
                  and{" "}
                  <LegalInlineLink kind="privacy">Privacy Policy</LegalInlineLink>.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
              <p className="text-sm text-center text-muted-foreground">
                Already registered? <Link href="/login">Sign in</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
