import { dashboardPath, isAdminRole } from "@bseva/config";
import { errorKeyForCode } from "@bseva/locales";
import { apiErrorMessage, userMessage } from "@/utils/userMessage";
import { loginSchema } from "@bseva/validation";
import { ApiError, isCaptchaErrorCode, type CaptchaFlags } from "@bseva/api-client";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { CaptchaField, type CaptchaHandle } from "@/components/CaptchaField";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { BrandLockup } from "@/components/BrandLockup";
import { ScreenHeader } from "@/components/ScreenHeader";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient, resolveApiBase } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { isPujariApp, roleAllowedInApp, variantRole, wrongAppMessageKey } from "@/config/appVariant";
import { InlineLink } from "@/components/InlineLink";
import { text as ctext } from "@/content/compliance";
import { openLegal } from "@/utils/webLinks";

function routeForRole(role: string) {
  const dest = dashboardPath(role);
  if (dest === "admin-web") return "/admin-web";
  return dest;
}

export default function LoginScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  // Single-role apps (B-Seva / B-Seva Pujari) always sign in their own role.
  const roleHint = variantRole ?? (role === "pujari" ? "pujari" : role === "customer" ? "customer" : undefined);
  const router = useRouter();
  const { refresh, logout } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when the account is deactivated and waiting for deletion; offers the cancel flow.
  const [deletionPending, setDeletionPending] = useState<string | null>(null);
  const config = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const flags = (config.data?.captcha || {}) as Partial<CaptchaFlags>;
  // The Super Admin switch for this app's sign-in (no role: the stricter one), or the server asked for it.
  const loginSwitchOn = roleHint ? Boolean(flags[`${roleHint}_login`]) : Boolean(flags.customer_login || flags.pujari_login);
  const [captchaAsked, setCaptchaAsked] = useState(false);
  const showCaptcha = captchaAsked || loginSwitchOn;
  const captchaRef = useRef<CaptchaHandle>(null);

  async function onSubmit() {
    setError(null);
    setDeletionPending(null);
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "auth.checkDetails";
      setError(userMessage(t, msg, t("auth.checkDetails")) || t("auth.checkDetails"));
      return;
    }
    setPending(true);
    try {
      const out = await apiClient.login(identifier.trim(), password, {
        ...(roleHint ? { portal: roleHint } : {}),
        ...(showCaptcha ? captchaRef.current?.values() : {}),
      });
      if (!roleAllowedInApp(out.user.role)) {
        // Valid account, wrong app: end this session and point to the right app.
        await logout();
        setError(t(wrongAppMessageKey(out.user.role)));
        return;
      }
      await refresh();
      if (isAdminRole(out.user.role)) {
        router.replace("/admin-web");
        return;
      }
      router.replace(routeForRole(out.user.role) as never);
    } catch (e: unknown) {
      const code = e instanceof ApiError ? e.code : undefined;
      // Each image works once.
      if (showCaptcha) captchaRef.current?.refresh();
      if (isCaptchaErrorCode(code)) setCaptchaAsked(true);
      if (code === "ACCOUNT_DELETION_PENDING") {
        setDeletionPending((e as ApiError).message || ctext.deletionPendingTitle);
        return;
      }
      const key = errorKeyForCode(code);
      let msg = key ? userMessage(t, key, t("errors.loginFailed")) || t("errors.loginFailed") : apiErrorMessage(t, e, "errors.loginFailed");
      if (__DEV__ && code === "NETWORK") {
        msg = `${msg}\n\nAPI: ${resolveApiBase()}\nStart FastAPI on the host (uvicorn app.main:app --host 0.0.0.0 --port 8000) or set EXPO_PUBLIC_API_URL in apps/mobile/.env.`;
      }
      setError(msg);
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
              {showCaptcha ? <CaptchaField ref={captchaRef} purpose="login" disabled={pending} /> : null}
              {deletionPending ? (
                <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.secondary }}>
                  <AppText style={{ fontWeight: "700" }}>{ctext.deletionPendingTitle}</AppText>
                  <AppText variant="small">{deletionPending}</AppText>
                  <PrimaryButton
                    title={ctext.cancelDeletion}
                    variant="outline"
                    onPress={() =>
                      router.push({
                        pathname: "/cancel-deletion",
                        params: identifier.includes("@") ? { email: identifier.trim() } : {},
                      })
                    }
                  />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                style={{ alignSelf: "flex-end", minHeight: 32, justifyContent: "center" }}
                onPress={() =>
                  router.push({
                    pathname: "/forgot-password",
                    params: identifier.includes("@") ? { email: identifier.trim() } : {},
                  })
                }
              >
                <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                  {ctext.forgotPasswordLink}
                </AppText>
              </Pressable>
              <PrimaryButton title={pending ? t("auth.signingIn") : t("auth.signIn")} loading={pending} onPress={onSubmit} />
              <Pressable onPress={() => router.push({ pathname: "/register", params: roleHint ? { role: roleHint } : {} })}>
                <AppText color={colors.primary} style={{ textAlign: "center", fontWeight: "700" }}>
                  {t("mobile.createAccount")}
                </AppText>
              </Pressable>
              <AppText variant="small" color={colors.mutedForeground} style={{ textAlign: "center", lineHeight: 20 }}>
                {ctext.loginLegalPrefix}{" "}
                <InlineLink
                  label={ctext.terms}
                  onPress={() => void openLegal(isPujariApp || roleHint === "pujari" ? "pujariTerms" : "customerTerms")}
                />{" "}
                {ctext.and} <InlineLink label={ctext.privacyPolicy} onPress={() => void openLegal("privacy")} />.
              </AppText>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} />
    </Screen>
  );
}
