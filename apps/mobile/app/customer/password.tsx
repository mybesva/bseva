import { changePasswordSchema } from "@bseva/validation";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function ChangePasswordScreen() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <ScreenHeader title={t("mobile.changePassword")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <ErrorBanner message={error} />
        {ok ? <AppText>{t("mobile.passwordUpdated")}</AppText> : null}
        <Field label={t("mobile.currentPassword")} value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label={t("mobile.newPassword")} value={next} onChangeText={setNext} secureTextEntry />
        <Field label={t("mobile.confirmPassword")} value={confirm} onChangeText={setConfirm} secureTextEntry />
        <PrimaryButton
          title={busy ? t("mobile.saving") : t("mobile.updatePassword")}
          loading={busy}
          onPress={async () => {
            const parsed = changePasswordSchema.safeParse({
              current_password: current,
              new_password: next,
              confirm,
            });
            if (!parsed.success) {
              setError(t("mobile.checkPasswords"));
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
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
