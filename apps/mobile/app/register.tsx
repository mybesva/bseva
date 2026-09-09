import { dashboardPath, LANGS, PRIVACY_VERSION, REGISTRATION_CONSENT_LABEL, TERMS_VERSION } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import { registerSchema } from "@bseva/validation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function RegisterScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const { setLang, lang } = useI18n();
  const { colors } = useAppTheme();
  const [accountType, setAccountType] = useState<"customer" | "pujari">(role === "pujari" ? "pujari" : "customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<Lang>(lang);
  const [requestedLevel, setRequestedLevel] = useState(2);
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendOtp() {
    setError(null);
    if (!phone && !email) {
      setError("Enter phone or email first");
      return;
    }
    try {
      await apiClient.requestOtp({ phone, email, purpose: "register" });
      setOtpSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send OTP");
    }
  }

  async function onSubmit() {
    setError(null);
    const parsed = registerSchema.safeParse({
      account_type: accountType,
      name,
      email,
      phone,
      password,
      confirmPassword,
      otp,
      language,
      calendar_preference: "north",
      requested_level: accountType === "pujari" ? requestedLevel : undefined,
      registration_consent: consent,
      referral_code: referralCode.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your details");
      return;
    }
    setPending(true);
    try {
      const out = await apiClient.register({
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
      <ScreenHeader title="Create your BSeva account" back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Customer"
                  variant={accountType === "customer" ? "primary" : "outline"}
                  onPress={() => setAccountType("customer")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Pujari"
                  variant={accountType === "pujari" ? "navy" : "outline"}
                  onPress={() => setAccountType("pujari")}
                />
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <ErrorBanner message={error} />
              <Field label="Full name" value={name} onChangeText={setName} />
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
              <AppText variant="small">Preferred language</AppText>
              <View style={{ flexDirection: "row", gap: 8 }}>
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
              {accountType === "pujari" ? (
                <Field
                  label="Requested service level (1–4)"
                  value={String(requestedLevel)}
                  onChangeText={(v) => setRequestedLevel(Math.min(4, Math.max(1, Number(v) || 1)))}
                  keyboardType="number-pad"
                />
              ) : null}
              <Field label="Referral code (optional)" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
              <PrimaryButton title={otpSent ? "Resend OTP" : "Send OTP"} variant="outline" onPress={sendOtp} />
              <Field label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary }} />
                <AppText variant="small" style={{ flex: 1 }}>
                  {REGISTRATION_CONSENT_LABEL}
                </AppText>
              </View>
              <PrimaryButton title={pending ? "Creating..." : "Create account"} loading={pending} onPress={onSubmit} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
