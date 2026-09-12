import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordInput, { passwordStrengthOk } from "@/components/PasswordInput";
import { LegalInlineLink } from "@/components/LegalModal";
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { api, registerApi } from "@/lib/api";
import { REGISTRATION_CONSENT_LABEL, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/translations";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { safeReturnUrl } from "@/const";
import { usePublicConfig } from "@/hooks/usePublicConfig";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEN_DIGIT_RE = /^\d{10}$/;
const OTP_VALIDITY_SEC = 10 * 60;

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
] as const;

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function toE164(countryCode: string, national: string) {
  const digits = national.replace(/\D/g, "");
  const cc = (countryCode || "+91").trim() || "+91";
  return `${cc}${digits}`;
}

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
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [requestedLevel, setRequestedLevel] = useState(2);
  const [consent, setConsent] = useState(false);
  const [humanCheck, setHumanCheck] = useState(false);
  const [pending, setPending] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [language, setLanguage] = useState<Lang>(lang);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string; otp?: string }>({});
  const { levels: pujariLevels } = usePujariLevels();

  const otpExpired = otpSent && otpSecondsLeft <= 0;
  const canResendOtp = !otpSending && (!otpSent || otpSecondsLeft <= OTP_VALIDITY_SEC - 30);

  useEffect(() => {
    if (!otpExpiresAt) {
      setOtpSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setOtpSecondsLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [otpExpiresAt]);

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

  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  function validateContactFields() {
    const next: { email?: string; phone?: string } = {};
    const emailNorm = email.trim().toLowerCase();
    if (!EMAIL_RE.test(emailNorm)) {
      next.email = "Enter a valid email address";
    }
    if (countryCode === "+91") {
      if (!TEN_DIGIT_RE.test(phoneDigits)) {
        next.phone = "Enter a valid 10-digit Indian mobile number";
      }
    } else if (phoneDigits.length < 8 || phoneDigits.length > 12) {
      next.phone = "Enter a valid phone number (8–12 digits)";
    }
    setFieldErrors((prev) => ({ ...prev, ...next, otp: prev.otp }));
    return { ok: Object.keys(next).length === 0, emailNorm, errors: next };
  }

  async function sendOtp() {
    const { ok, emailNorm, errors } = validateContactFields();
    if (!ok) {
      toast.error(errors.email || errors.phone || "Fix the highlighted fields");
      return;
    }
    setOtpSending(true);
    try {
      const phoneE164 = toE164(countryCode, phoneDigits);
      const out = await api<{ ok: boolean; message?: string; expires_in_minutes?: number; dev_hint?: string }>(
        "/auth/otp/request",
        {
          method: "POST",
          body: JSON.stringify({ phone: phoneE164, email: emailNorm, purpose: "register" }),
        }
      );
      const mins = out.expires_in_minutes ?? 10;
      setOtpSent(true);
      setOtpExpiresAt(Date.now() + mins * 60 * 1000);
      setOtpMessage(
        `OTP sent to ${emailNorm}. Valid for ${mins} minutes — enter it below before the timer ends.`
      );
      setFieldErrors((prev) => ({ ...prev, otp: undefined }));
      toast.success(`OTP sent to ${emailNorm}. Valid for ${mins} minutes.`);
      if (out.dev_hint) {
        toast.message(`Dev hint: ${out.dev_hint}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not send OTP");
    } finally {
      setOtpSending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { ok, emailNorm, errors } = validateContactFields();
    if (!ok) {
      toast.error(errors.email || errors.phone || "Fix the highlighted fields");
      return;
    }
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
    if (!otpSent) {
      toast.error("Send the OTP to your email first");
      return;
    }
    if (otpExpired) {
      toast.error("OTP expired. Please send a new code.");
      return;
    }
    if (!otp.trim()) {
      setFieldErrors((prev) => ({ ...prev, otp: "Enter the verification code" }));
      toast.error("Enter the verification code sent to your email");
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
      const phoneE164 = toE164(countryCode, phoneDigits);
      await registerApi({
        account_type: accountType,
        name: name.trim(),
        email: emailNorm,
        phone: phoneE164,
        password,
        otp: otp.trim(),
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
      toast.success(`Welcome, ${name.trim()}. You can add your address after signing in.`);
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
                : accountType === "pujari"
                  ? "Register as a Pujari. Complete your profile after Login."
                  : "Register as a Customer. Address and location can be added after Login."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit} autoComplete="off" noValidate>
              {!isPujariFlow && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={accountType === "customer" ? "default" : "outline"}
                    onClick={() => setAccountType("customer")}
                  >
                    Customer
                  </Button>
                  <Button
                    type="button"
                    variant={accountType === "pujari" ? "default" : "outline"}
                    onClick={() => setAccountType("pujari")}
                  >
                    Pujari
                  </Button>
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
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="off"
                    name="bseva-reg-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    required
                    autoComplete="off"
                    name="bseva-reg-email"
                    aria-invalid={!!fieldErrors.email}
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 w-full">
                    <select
                      aria-label="Country code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="h-10 w-full max-w-[4.75rem] rounded-md border border-input bg-background px-1.5 text-sm font-bold text-center"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, countryCode === "+91" ? 10 : 12);
                        setPhone(raw);
                        setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      required
                      autoComplete="off"
                      name="bseva-reg-phone"
                      placeholder={countryCode === "+91" ? "10-digit mobile" : "Phone number"}
                      className="min-w-0"
                      aria-invalid={!!fieldErrors.phone}
                    />
                  </div>
                  {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
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
                  <select
                    className="w-full h-10 rounded-md border px-2 text-sm"
                    value={requestedLevel}
                    onChange={(e) => setRequestedLevel(Number(e.target.value))}
                  >
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
                  <Input
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 8));
                      setFieldErrors((prev) => ({ ...prev, otp: undefined }));
                    }}
                    placeholder="Enter OTP"
                    required
                    aria-invalid={!!fieldErrors.otp}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canResendOtp}
                    onClick={() => void sendOtp()}
                  >
                    {otpSending ? "Sending…" : otpSent ? "Resend" : "Send OTP"}
                  </Button>
                </div>
                {fieldErrors.otp && <p className="text-xs text-destructive">{fieldErrors.otp}</p>}
                {otpSent && otpMessage && (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      otpExpired
                        ? "border-destructive/40 bg-destructive/5 text-destructive"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100"
                    }`}
                  >
                    <p>{otpExpired ? "OTP expired. Click Resend to get a new code." : otpMessage}</p>
                    {!otpExpired && (
                      <p className="mt-1 font-semibold tabular-nums">
                        Time remaining: {formatMmSs(otpSecondsLeft)}
                      </p>
                    )}
                  </div>
                )}
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
                <Label>
                  {t("rewards.codeLabel")} ({t("common.optional")})
                </Label>
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
                  <LegalInlineLink kind="terms">Terms & Conditions</LegalInlineLink> and{" "}
                  <LegalInlineLink kind="privacy">Privacy Policy</LegalInlineLink>.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account…" : "Create account"}
              </Button>
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
