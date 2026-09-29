import { changePasswordSchema } from "@bseva/validation";
import { useState } from "react";
import { View } from "react-native";
import { AppText, ErrorBanner, Field, PrimaryButton } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { apiErrorMessage, userMessage } from "@/utils/userMessage";

export function ChangePasswordForm() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <View style={{ gap: 12 }}>
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
            setError(
              userMessage(t, parsed.error.issues[0]?.message, t("mobile.checkPasswords")) ||
                t("mobile.checkPasswords"),
            );
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
            setError(apiErrorMessage(t, e, "mobile.failed"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}
