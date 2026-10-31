import { isAdminRole } from "@bseva/config";
import { loginSchema } from "@bseva/validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { BrandLockup } from "@/components/BrandLockup";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminLogin() {
  const { refresh, rejectedReason } = useAuth();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [challenge, setChallenge] = useState<{ token: string; emailHint: string } | null>(null);
  const [otp, setOtp] = useState("");

  async function enter(role: string) {
    if (!isAdminRole(role)) {
      await apiClient.logout();
      setError(t("admin.rejectNonAdmin"));
      return;
    }
    await refresh();
    router.replace("/(app)");
  }

  async function onSubmitOtp() {
    if (!challenge) return;
    setError(null);
    setPending(true);
    try {
      const out = await apiClient.completeLoginOtp(challenge.token, otp.trim());
      await enter(out.user.role);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit() {
    setError(null);
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message;
      setError(key ? t(key) : t("auth.checkDetails"));
      return;
    }
    setPending(true);
    try {
      const out = await apiClient.startLogin(identifier.trim(), password);
      if (out.otp_required && out.challenge_token) {
        setPassword("");
        setChallenge({ token: out.challenge_token, emailHint: out.email_hint || "your email" });
        return;
      }
      await enter(String(out.user?.role));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.signIn")} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Card>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <BrandLockup height={128} />
            </View>
            <AppText color={colors.mutedForeground} style={{ marginBottom: 16 }}>
              {t("admin.signInHint")}
            </AppText>
            <View style={{ gap: 14 }}>
              <ErrorBanner message={error || rejectedReason} />
              {challenge ? (
                <>
                  <AppText color={colors.mutedForeground}>Enter the 6-digit OTP sent to {challenge.emailHint}.</AppText>
                  <Field label="One-time password" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                  <PrimaryButton title="Verify OTP" loading={pending} onPress={onSubmitOtp} />
                  <PrimaryButton
                    title="Resend OTP"
                    variant="outline"
                    onPress={async () => {
                      setError(null);
                      try {
                        await apiClient.resendLoginOtp(challenge.token);
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  />
                </>
              ) : (
              <>
              <Field label={t("auth.emailOrPhone")} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
              <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton title={pending ? t("admin.signingIn") : t("admin.signIn")} loading={pending} onPress={onSubmit} />
              </>
              )}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
