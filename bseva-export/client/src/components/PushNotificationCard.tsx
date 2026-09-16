import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fcmConfigured, registerFcmToken, sendTestPush } from "@/lib/fcm";
import { toast } from "sonner";

export default function PushNotificationCard() {
  const [busy, setBusy] = useState(false);
  const configured = fcmConfigured();

  async function enableAndTest() {
    setBusy(true);
    try {
      const token = await registerFcmToken();
      if (!token) {
        toast.error("Allow notifications in your browser, then try again.");
        return;
      }
      const out = await sendTestPush();
      toast.success(`Test push sent to ${out.success} device${out.success === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test push failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Browser notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {configured
            ? "Allow notifications so BSeva can alert you about bookings on this device."
            : "Firebase web messaging is not configured in this environment yet."}
        </p>
        <Button type="button" variant="outline" disabled={busy || !configured} onClick={() => void enableAndTest()}>
          {busy ? "Sending…" : "Enable and send test notification"}
        </Button>
      </CardContent>
    </Card>
  );
}
