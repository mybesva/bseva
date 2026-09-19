import { dashboardPath, isAdminRole } from "@bseva/config";
import { errorKeyForCode } from "@bseva/locales";
import { loginSchema } from "@bseva/validation";
import { ApiError } from "@bseva/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { BrandLockup } from "@/components/BrandLockup";
import { ScreenHeader } from "@/components/ScreenHeader";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

function routeForRole(role: string) {
  const dest = dashboardPath(role);
  if (dest === "admin-web") return "/admin-web";
  return dest;
}

export default function LoginScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const roleHint = role === "pujari" ? "pujari" : role === "customer" ? "customer" : undefined;
  const router = useRouter();
  const { refresh } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "auth.checkDetails";
      setError(t(msg));
      return;
    }
    setPending(true);
    try {
      const out = await apiClient.login(identifier.trim(), password);
      await refresh();
      if (isAdminRole(out.user.role)) {
        router.replace("/admin-web");
        return;
      }
      router.replace(routeForRole(out.user.role) as never);
    } catch (e: unknown) {
      const code = e instanceof ApiError ? e.code : undefined;
      const key = errorKeyForCode(code);
      setError(key ? t(key) : e instanceof Error ? e.message : t("errors.loginFailed"));
    } finally {
      setPending(false);
    }
  }

  const title =
    roleHint === "pujari" ? t("mobile.signInPujari") : roleHint === "customer" ? t("mobile.signInCustomer") : t("auth.loginTitle");

  return (
    <Screen>
      <ScreenHeader title={title} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <BrandLockup height={128} />
            </View>
            <AppText color={colors.mutedForeground} style={{ marginBottom: 16, lineHeight: 22 }}>
              {roleHint === "pujari"
                ? t("auth.pujariLoginDescription")
                : roleHint === "customer"
                  ? t("auth.customerLoginDescription")
                  : `${t("auth.loginDesc")} ${t("auth.loginMobileHint")}`}
            </AppText>
            <LanguagePicker />
            <View style={{ gap: 14 }}>
              <ErrorBanner message={error} />
              <Field
                label={t("auth.emailOrPhone")}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton title={pending ? t("auth.signingIn") : t("auth.signIn")} loading={pending} onPress={onSubmit} />
              <Pressable onPress={() => router.push({ pathname: "/register", params: roleHint ? { role: roleHint } : {} })}>
                <AppText color={colors.primary} style={{ textAlign: "center", fontWeight: "700" }}>
                  {t("mobile.createAccount")}
                </AppText>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
