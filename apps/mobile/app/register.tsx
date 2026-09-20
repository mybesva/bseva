import { dashboardPath, LANGS, PHONE_COUNTRY_CODES, PRIVACY_VERSION, REGISTRATION_CONSENT_LABEL, TERMS_VERSION, toE164 } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import { registerSchema } from "@bseva/validation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { BrandLockup } from "@/components/BrandLockup";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function RegisterScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const { setLang, lang, t } = useI18n();
  const { colors } = useAppTheme();
  const [accountType, setAccountType] = useState<"customer" | "pujari">(role === "pujari" ? "pujari" : "customer");
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
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<Lang>(lang);
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendOtp() {
    setError(null);
    const e164 = toE164(countryCode, phone);
    if (!e164 && !email) {
      setError(t("validation.identifier"));
      return;
    }
    try {
      await apiClient.requestOtp({ phone: e164 || undefined, email, purpose: "register" });
      setOtpSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send OTP");
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
      calendar_preference: "north",
      registration_consent: consent,
      referral_code: referralCode.trim() || undefined,
    });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message || "auth.checkDetails"));
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
        calendar_preference: "north",
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
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
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
              <AppText variant="small">{t("auth.phone")}</AppText>
              <ChoiceChips options={PHONE_COUNTRY_CODES.map((c: { code: string }) => ({ id: c.code, label: c.code }))} value={countryCode} onChange={(v) => setCountryCode(String(v))} />
              <Field label={t("auth.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
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
              <PrimaryButton title={otpSent ? t("auth.resendOtp") : t("auth.sendOtp")} variant="outline" onPress={sendOtp} />
              {otpSent ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {t("auth.otpDemo")}
                </AppText>
              ) : null}
              <Field label={t("auth.otp")} value={otp} onChangeText={setOtp} keyboardType="number-pad" />
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary }} />
                <AppText variant="small" style={{ flex: 1 }}>
                  {REGISTRATION_CONSENT_LABEL}
                </AppText>
              </View>
              <Pressable onPress={() => router.push("/legal/platform_terms")}>
                <AppText color={colors.primary} variant="small">{t("nav.terms")}</AppText>
              </Pressable>
              <Pressable onPress={() => router.push("/legal/privacy")}>
                <AppText color={colors.primary} variant="small">{t("nav.privacy")}</AppText>
              </Pressable>
              <PrimaryButton title={pending ? t("common.loading") : t("auth.createAccount")} loading={pending} onPress={onSubmit} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
