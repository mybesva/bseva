import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import PasswordInput, { passwordStrengthOk } from "@/components/PasswordInput";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

export default function ChangePasswordForm() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error(t("validation.passwordMatch"));
      return;
    }
    if (!passwordStrengthOk(next)) {
      toast.error(t("validation.password"));
      return;
    }
    setPending(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      toast.success(t("auth.passwordChanged"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err: any) {
      toast.error(err.message || t("web.password.changeFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="">{t("auth.changePassword")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current">{t("auth.currentPassword")}</Label>
            <PasswordInput id="current" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">{t("auth.newPassword")}</Label>
            <PasswordInput id="new" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">{t("validation.password")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
            <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t("web.password.updating") : t("web.password.update")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
