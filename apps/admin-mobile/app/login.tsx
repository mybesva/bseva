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
      const out = await apiClient.login(identifier.trim(), password);
      if (!isAdminRole(out.user.role)) {
        await apiClient.logout();
        setError(t("admin.rejectNonAdmin"));
        return;
      }
      await refresh();
      router.replace("/(app)");
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
              <Field label={t("auth.emailOrPhone")} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
              <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton title={pending ? t("admin.signingIn") : t("admin.signIn")} loading={pending} onPress={onSubmit} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
