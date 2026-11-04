import { ApiError } from "@bseva/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isEmail, isSixDigitCode, OtpCodeField } from "@/components/OtpCodeField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { OTP_RESEND_SECONDS, PASSWORD_MIN, text } from "@/content/compliance";
import { useCountdown } from "@/hooks/useCountdown";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(typeof params.email === "string" && isEmail(params.email) ? params.email : "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const resend = useCountdown();

  async function sendCode(): Promise<boolean> {
    setError(null);
    if (!isEmail(email)) {
      setError(text.enterEmail);
      return false;
    }
    setSending(true);
    try {
      const out = await apiClient.forgotPassword(email.trim().toLowerCase());
      setNotice(out?.message || text.forgotGeneric);
      resend.start(OTP_RESEND_SECONDS);
      return true;
    } catch (e: unknown) {
      // A 429 carries the same generic wording for any email; show it as returned.
      if (e instanceof ApiError && e.status === 429) {
        setError(e.message || text.somethingWrong);
        resend.start(OTP_RESEND_SECONDS);
        return false;
      }
      setError(e instanceof ApiError && e.code === "NETWORK" ? e.message : text.somethingWrong);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function submitReset() {
    setError(null);
    if (!isSixDigitCode(code)) return setError(text.enterCode);
    if (password.length < PASSWORD_MIN) return setError(text.passwordTooShort);
    if (password !== confirm) return setError(text.passwordsDontMatch);
    setBusy(true);
    try {
      await apiClient.resetPassword({ email: email.trim().toLowerCase(), code: code.trim(), new_password: password });
      setStep("done");
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.code === "INVALID_CODE" || e.status === 400)) setError(text.invalidCode);
      else if (e instanceof ApiError && (e.status === 429 || e.code === "NETWORK")) setError(e.message);
      else setError(text.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={text.forgotTitle} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 14 }}>
            {step === "email" ? (
              <>
                <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
                  {text.forgotIntro}
                </AppText>
                <ErrorBanner message={error} />
                <Field
                  label={text.email}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <PrimaryButton
                  title={sending ? text.sending : text.sendCode}
                  loading={sending}
                  onPress={async () => {
                    if (await sendCode()) setStep("reset");
                  }}
                />
              </>
            ) : null}

            {step === "reset" ? (
              <>
                {notice ? (
                  <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
                    {notice}
                  </AppText>
                ) : null}
                <AppText variant="small" color={colors.mutedForeground}>
                  {email.trim()}
                </AppText>
                <ErrorBanner message={error} />
                <OtpCodeField
                  value={code}
                  onChange={setCode}
                  resendLeft={resend.left}
                  resending={sending}
                  onResend={() => void sendCode()}
                />
                <Field label={text.newPassword} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
                <Field label={text.confirmPassword} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
                <PrimaryButton title={busy ? text.resetting : text.resetPassword} loading={busy} onPress={submitReset} />
                <PrimaryButton
                  title={text.changeEmail}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                  }}
                />
              </>
            ) : null}

            {step === "done" ? (
              <View style={{ gap: 14 }}>
                <AppText style={{ lineHeight: 22 }}>{text.resetDone}</AppText>
                <PrimaryButton title={text.backToSignIn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))} />
              </View>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
