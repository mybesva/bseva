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
import type { Lang } from "@/i18n/translations";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { safeReturnUrl } from "@/const";
import { usePublicConfig } from "@/hooks/usePublicConfig";

export default function Register() {
  const { t, lang, setLang, labels } = useI18n();
  const { config: publicConfig } = usePublicConfig();
  const captchaEnabled = Boolean(publicConfig.registration_captcha_enabled);
  const captchaSiteKey = String(publicConfig.recaptcha_site_key || "");
  const [, setLocation] = useLocation();
  const roleHint = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("role");
  const isPujariFlow = roleHint === "pujari";
  const returnUrl = safeReturnUrl(
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("returnUrl")
  );
  const [accountType, setAccountType] = useState<"customer" | "pujari">(isPujariFlow ? "pujari" : "customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requestedLevel, setRequestedLevel] = useState(2);
  const [consent, setConsent] = useState(false);
  const [humanCheck, setHumanCheck] = useState(false);
  const [pending, setPending] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [language, setLanguage] = useState<Lang>(lang);
  const { levels: pujariLevels } = usePujariLevels();

  useEffect(() => {
    if (!captchaEnabled || !captchaSiteKey || typeof document === "undefined") return;
    const existing = document.querySelector("script[data-bseva-recaptcha]");
    if (existing) return;
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(captchaSiteKey)}`;
    s.async = true;
    s.defer = true;
    s.dataset.bsevaRecaptcha = "1";
    document.head.appendChild(s);
  }, [captchaEnabled, captchaSiteKey]);

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
      toast.success("Verification code sent. Use 123456");
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
    if (captchaEnabled && !humanCheck && !captchaSiteKey) {
      toast.error("Please confirm you are not a robot");
      return;
    }
    setPending(true);
    try {
      let captcha_token: string | undefined;
      if (captchaEnabled) {
        if (captchaSiteKey && typeof window !== "undefined" && (window as any).grecaptcha) {
          captcha_token = await (window as any).grecaptcha.execute(captchaSiteKey, { action: "register" });
        } else if (humanCheck) {
          captcha_token = "dev-bypass";
        } else {
          toast.error("CAPTCHA verification is required");
          setPending(false);
          return;
        }
      }
      await registerApi({
        account_type: accountType,
        name,
        email,
        phone,
        password,
        otp,
        language,
        calendar_preference: "north",
        requested_level: accountType === "pujari" ? requestedLevel : undefined,
        registration_consent: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        referral_code: referralCode.trim() || undefined,
        captcha_token,
      });
      setLang(language);
      toast.success(`Welcome, ${name}. You can add your address after signing in.`);
      if (returnUrl && accountType === "customer") {
        setLocation(returnUrl);
      } else {
        setLocation(accountType === "pujari" ? "/pujari/onboarding" : "/customer/address");
      }
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
            <CardTitle className="text-2xl">
              {isPujariFlow ? "Create your Pujari account" : "Create your BSeva account"}
            </CardTitle>
            <CardDescription>
              {isPujariFlow
                ? "Register as a Pujari. Complete your profile after Login."
                : "Register as a Customer. Address and location can be added after Login."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit} autoComplete="off">
              {!isPujariFlow && (
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={accountType === "customer" ? "default" : "outline"} onClick={() => setAccountType("customer")}>Customer</Button>
                  <Button type="button" variant={accountType === "pujari" ? "default" : "outline"} onClick={() => setAccountType("pujari")}>Pujari</Button>
                </div>
              )}
              {isPujariFlow && (
                <p className="text-sm rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-foreground">
                  Registering as <strong>Pujari</strong>. Role is assigned securely by BSeva.
                </p>
              )}
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
                <div className="md:col-span-2 space-y-2">
                  <Label>Preferred language</Label>
                  <select
                    className="w-full h-10 rounded-md border px-2 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Lang)}
                  >
                    {(Object.keys(labels) as Lang[]).map((code) => (
                      <option key={code} value={code}>
                        {labels[code]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    We will show the site and send notifications in this language.
                  </p>
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
              {captchaEnabled && (
                <div className="flex items-start gap-2 rounded-md border border-border p-3">
                  <Checkbox id="human" checked={humanCheck} onCheckedChange={(v) => setHumanCheck(!!v)} />
                  <Label htmlFor="human" className="text-sm font-normal leading-snug">
                    I am not a robot
                    {captchaSiteKey
                      ? " (reCAPTCHA will verify on submit)"
                      : " — enable RECAPTCHA_SECRET_KEY=dev-bypass for local testing"}
                  </Label>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("rewards.codeLabel")} ({t("common.optional")})</Label>
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="CUST1234-RC / PUJARI1234-RC"
                  autoComplete="off"
                />
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
              <Button type="submit" className="w-full" disabled={pending}>{pending ?"Creating account…" :"Create account"}</Button>
              <p className="text-sm text-center text-muted-foreground">
                Already registered? <Link href="/login">{t("auth.login")}</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
