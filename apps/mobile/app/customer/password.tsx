import { changePasswordSchema } from "@bseva/validation";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <ScreenHeader title="Change password" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <ErrorBanner message={error} />
        {ok ? <AppText>Password updated.</AppText> : null}
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry />
        <Field label="Confirm" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <PrimaryButton
          title={busy ? "Saving..." : "Update password"}
          loading={busy}
          onPress={async () => {
            const parsed = changePasswordSchema.safeParse({
              current_password: current,
              new_password: next,
              confirm,
            });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message || "Check passwords");
              setOk(false);
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await apiClient.changePassword(current, next);
              setOk(true);
              setCurrent("");
              setNext("");
              setConfirm("");
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
