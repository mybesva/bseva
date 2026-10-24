import { dashboardPath, LANGS, PRIVACY_VERSION, TERMS_VERSION, toE164 } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import { registerSchema } from "@bseva/validation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { InlineLink } from "@/components/InlineLink";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { PhoneWithCountryCode } from "@/components/PhoneWithCountryCode";
import { BrandLockup } from "@/components/BrandLockup";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { userMessage } from "@/utils/userMessage";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { variantRole } from "@/config/appVariant";

export default function RegisterScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const { setLang, lang, t } = useI18n();
  const { colors } = useAppTheme();
  const [accountType, setAccountType] = useState<"customer" | "pujari">(
    variantRole ?? (role === "pujari" ? "pujari" : "customer"),
  );
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState("");
  const [otpValidMins, setOtpValidMins] = useState(10);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<Lang>(lang);
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Countdown for the emailed code (same behaviour as the web sign-up).
  useEffect(() => {
    if (!otpExpiresAt) return;
    const tick = () => setOtpSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpExpiresAt]);
  const otpExpired = otpSent && otpExpiresAt != null && otpSecondsLeft <= 0;
  // Short cooldown before Resend so the code isn't re-requested by double taps.
  const canResendOtp = !otpSending && (!otpSent || otpSecondsLeft <= otpValidMins * 60 - 30);
  const mmss = `${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, "0")}`;

  async function sendOtp() {
    setError(null);
    const e164 = toE164(countryCode, phone);
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      // The registration code is emailed, so an email address is needed first.
      setError(t("contact.errEmail"));
      return;
    }
    setOtpSending(true);
    try {
      const out = (await apiClient.requestOtp({ phone: e164 || undefined, email: emailNorm, purpose: "register" })) as {
        expires_in_minutes?: number;
        email?: string;
      };
      const mins = out?.expires_in_minutes ?? 10;
      setOtpSentTo(out?.email || emailNorm);
      setOtpValidMins(mins);
      setOtpExpiresAt(Date.now() + mins * 60 * 1000);
      setOtpSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setOtpSending(false);
    }
  }

  async function onSubmit() {
    setError(null);
    const phoneE164 = toE164(countryCode, phone);
    const displayName =
      accountType === "pujari"
        ? [firstName, middleName, lastName].map((s) => s.trim()).filter(Boolean).join(" ")
        : name.trim();
    const parsed = registerSchema.safeParse({
      account_type: accountType,
      name: displayName,
      first_name: accountType === "pujari" ? firstName.trim() : undefined,
      middle_name: accountType === "pujari" ? middleName.trim() || undefined : undefined,
      last_name: accountType === "pujari" ? lastName.trim() : undefined,
      email,
      phone: phoneE164,
      password,
      confirmPassword,
      otp,
      language,
      calendar_preference: "solar",
      registration_consent: consent,
      referral_code: referralCode.trim() || undefined,
    });
    if (!parsed.success) {
      setError(userMessage(t, parsed.error.issues[0]?.message, t("auth.checkDetails")) || t("auth.checkDetails"));
      return;
    }
    setPending(true);
    try {
      const out = await apiClient.register({
        account_type: accountType,
        name: displayName,
        ...(accountType === "pujari"
          ? { first_name: firstName.trim(), middle_name: middleName.trim() || undefined, last_name: lastName.trim() }
          : {}),
        email,
        phone: phoneE164,
        password,
        otp,
        language,
        calendar_preference: "solar",
        registration_consent: true,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        referral_code: referralCode.trim() || undefined,
      });
      setLang(language);
      await refresh();
      const dest = dashboardPath(out.user.role);
      if (dest === "admin-web") router.replace("/admin-web");
      else if (accountType === "pujari") router.replace("/pujari/onboarding");
      else router.replace("/customer/address");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("auth.registerTitle")} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <BrandLockup height={128} />
            </View>
            {/* Account-type switch only in the combined app; single-role apps register their own role. */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, display: variantRole ? "none" : "flex" }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={t("auth.customer")}
                  variant={accountType === "customer" ? "primary" : "outline"}
                  onPress={() => setAccountType("customer")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={t("auth.pujari")}
                  variant={accountType === "pujari" ? "navy" : "outline"}
                  onPress={() => setAccountType("pujari")}
                />
              </View>
            </View>
            <AppText color={colors.mutedForeground} style={{ marginBottom: 16, lineHeight: 22 }}>
              {accountType === "pujari"
                ? t("auth.pujariRegisterDescription")
                : t("auth.customerRegisterDescription")}
            </AppText>
            <View style={{ gap: 12 }}>
              <ErrorBanner message={error} />
              {accountType === "pujari" ? (
                <>
                  <Field label={t("auth.firstName")} value={firstName} onChangeText={setFirstName} />
                  <Field label={t("auth.middleName")} value={middleName} onChangeText={setMiddleName} />
                  <Field label={t("auth.lastName")} value={lastName} onChangeText={setLastName} />
                </>
              ) : (
                <Field label={t("auth.name")} value={name} onChangeText={setName} />
              )}
              <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <PhoneWithCountryCode
                label={t("auth.phone")}
                countryCode={countryCode}
                national={phone}
                onCountryCodeChange={setCountryCode}
                onNationalChange={setPhone}
              />
              <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry />
              <Field label={t("auth.confirmPassword")} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
              <AppText variant="small">{t("profile.preferredLanguage")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {LANGS.map((code) => (
                  <Pressable
                    key={code}
                    onPress={() => setLanguage(code)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: language === code ? colors.primary : colors.border,
                      backgroundColor: language === code ? colors.primary + "22" : "transparent",
                    }}
                  >
                    <AppText variant="small">{LANG_LABELS[code]}</AppText>
                  </Pressable>
                ))}
              </View>
              <Field label={t("auth.referralOptional")} value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
              <PrimaryButton
                title={otpSent ? t("auth.resendOtp") : t("auth.sendOtp")}
                variant="outline"
                loading={otpSending}
                disabled={!canResendOtp}
                onPress={sendOtp}
              />
              {otpSent ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    gap: 4,
                    borderColor: otpExpired ? "#F2B8B5" : "#A7E3C4",
                    backgroundColor: otpExpired ? "#FDECEC" : "#E9F8F0",
                  }}
                >
                  <AppText variant="small" style={{ color: otpExpired ? "#B42318" : "#065F46" }}>
                    {otpExpired ? t("auth.otpExpired") : t("auth.otpSentTo", { email: otpSentTo, mins: otpValidMins })}
                  </AppText>
                  {!otpExpired ? (
                    <AppText variant="small" style={{ color: "#065F46", fontWeight: "700" }}>
                      {t("auth.otpTimeLeft", { time: mmss })}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
              <Field label={t("auth.otp")} value={otp} onChangeText={setOtp} keyboardType="number-pad" />
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary }} />
                <AppText variant="small" style={{ flex: 1, paddingTop: 2 }}>
                  {t("mobile.registerConsentPrefix")}{" "}
                  <InlineLink label={t("mobile.terms")} href="/legal/platform_terms" />
                  {" "}
                  {t("mobile.acceptTermsAnd")}{" "}
                  <InlineLink label={t("mobile.privacy")} href="/legal/privacy" />
                  .
                </AppText>
              </View>
              <PrimaryButton title={pending ? t("common.loading") : t("auth.createAccount")} loading={pending} onPress={onSubmit} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
