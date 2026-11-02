import { ApiError } from "@bseva/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isEmail, isSixDigitCode, OtpCodeField } from "@/components/OtpCodeField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { OTP_RESEND_SECONDS, text } from "@/content/compliance";
import { useCountdown } from "@/hooks/useCountdown";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Step = "email" | "code" | "done";

/** Public flow: works while the account is deactivated (no sign-in needed). */
export default function CancelDeletionScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(typeof params.email === "string" && isEmail(params.email) ? params.email : "");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string>(text.cancelDone);
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
      const out = await apiClient.requestCancelDeletionOtp(email.trim().toLowerCase());
      setNotice(out?.message || text.cancelGeneric);
      resend.start(OTP_RESEND_SECONDS);
      return true;
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.status === 429 || e.code === "NETWORK")) {
        setError(e.message || text.somethingWrong);
        if (e.status === 429) resend.start(OTP_RESEND_SECONDS);
      } else {
        setError(text.somethingWrong);
      }
      return false;
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    setError(null);
    if (!isSixDigitCode(code)) return setError(text.enterCode);
    setBusy(true);
    try {
      const out = await apiClient.cancelDeletion({ email: email.trim().toLowerCase(), code: code.trim() });
      setDoneMessage(out?.message || text.cancelDone);
      setStep("done");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 400) setError(e.code === "INVALID_CODE" ? text.invalidCode : e.message || text.invalidCode);
      else if (e instanceof ApiError && (e.status === 429 || e.code === "NETWORK")) setError(e.message);
      else setError(text.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={text.cancelTitle} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 14 }}>
            {step === "email" ? (
              <>
                <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
                  {text.cancelIntro}
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
                    if (await sendCode()) setStep("code");
                  }}
                />
              </>
            ) : null}

            {step === "code" ? (
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
                <AppText variant="small" color={colors.mutedForeground}>
                  {text.cancelNote}
                </AppText>
                <PrimaryButton title={busy ? text.cancelling : text.confirmCancel} loading={busy} onPress={submit} />
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
                <AppText style={{ lineHeight: 22 }}>{doneMessage}</AppText>
                <AppText variant="small" color={colors.mutedForeground}>
                  {text.cancelNote}
                </AppText>
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
