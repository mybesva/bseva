import { dashboardPath, isAdminRole } from "@bseva/config";
import { loginSchema } from "@bseva/validation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
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
      await refresh();
      if (isAdminRole(out.user.role)) {
        router.replace("/admin-web");
        return;
      }
      router.replace(routeForRole(out.user.role) as never);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  const title = roleHint === "pujari" ? "Pujari sign in" : roleHint === "customer" ? "Customer sign in" : "Sign in to BSeva";

  return (
    <Screen>
      <ScreenHeader title={title} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Card>
            <AppText color={colors.mutedForeground} style={{ marginBottom: 16 }}>
              Use your registered email or phone and password. Your actual role comes from the server after sign-in.
            </AppText>
            <View style={{ gap: 14 }}>
              <ErrorBanner message={error} />
              <Field
                label="Email or phone"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton title={pending ? "Signing in..." : "Sign in"} loading={pending} onPress={onSubmit} />
              <Pressable onPress={() => router.push({ pathname: "/register", params: roleHint ? { role: roleHint } : {} })}>
                <AppText color={colors.primary} style={{ textAlign: "center", fontWeight: "700" }}>
                  Create an account
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
