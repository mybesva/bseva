import { isAdminRole } from "@bseva/config";
import { loginSchema } from "@bseva/validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
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
      setError(parsed.error.issues[0]?.message || "Check your details");
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
            <AppText color={colors.mutedForeground} style={{ marginBottom: 16 }}>
              Sign in with your Admin or Super Admin account. Role is read from the server.
            </AppText>
            <View style={{ gap: 14 }}>
              <ErrorBanner message={error || rejectedReason} />
              <Field label="Email or phone" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton title={pending ? "Signing in..." : t("admin.signIn")} loading={pending} onPress={onSubmit} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
