import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fcmConfigured, registerFcmToken, sendTestPush } from "@/lib/fcm";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

export default function PushNotificationCard() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const configured = fcmConfigured();

  async function enableAndTest() {
    setBusy(true);
    try {
      const token = await registerFcmToken();
      if (!token) {
        toast.error(t("web.notifications.allow"));
        return;
      }
      const out = await sendTestPush();
      toast.success(t("web.notifications.sent", { count: out.success }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("web.notifications.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t("web.notifications.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {configured
            ? t("web.notifications.description")
            : t("web.notifications.unconfigured")}
        </p>
        <Button type="button" variant="outline" disabled={busy || !configured} onClick={() => void enableAndTest()}>
          {busy ? t("web.notifications.sending") : t("web.notifications.enableTest")}
        </Button>
      </CardContent>
    </Card>
  );
}
