import { useEffect, useState } from "react";
import { Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

type Mandatory = { feature: string; label: string; enabled: true; locked: true };
type Configurable = {
  feature: "customer_register" | "pujari_register" | "customer_login" | "pujari_login";
  label: string;
  enabled: boolean;
  updated_by_name: string | null;
  updated_at: string | null;
};
type CaptchaView = {
  mandatory: Mandatory[];
  configurable: Configurable[];
  enforcement_active: boolean;
  history: { actor_name: string; reason: string; created_at: string }[];
};

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
}

/**
 * Super Admin only. Contact Us and Custom Puja are always on and have no switch. The four switches are saved on
 * the server, which records who changed each one.
 */
export default function CaptchaSettingsCard() {
  const [view, setView] = useState<CaptchaView | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api<CaptchaView>("/admin/security/captcha")
      .then(setView)
      .catch((e: Error) => toast.error(e.message || "Could not load CAPTCHA settings"));
  }, []);

  async function toggle(item: Configurable, enabled: boolean) {
    setSaving(item.feature);
    try {
      const next = await api<CaptchaView>(`/admin/security/captcha/${item.feature}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      setView(next);
      toast.success(`${item.label} CAPTCHA turned ${enabled ? "on" : "off"}.`);
    } catch (e: any) {
      toast.error(e.message || "Could not save the setting");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card id="settings-captcha" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="">CAPTCHA Settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          The 5-character security image shown to people who are not signed in. Applies to the website and the
          Customer and Pujari apps.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!view ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {!view.enforcement_active && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Registration and sign-in switches are saved but not enforced yet. They start working once the
                  updated mobile apps are released and enforcement is turned on for this server. Contact Us and
                  Custom Puja are enforced now.
                </span>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">Always on</h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {view.mandatory.map((item) => (
                  <li key={item.feature} className="flex items-center justify-between gap-3 p-3">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground"
                      title="Required for everyone who is not signed in. This cannot be turned off."
                    >
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                      Always Enabled
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Required for visitors who are not signed in and cannot be turned off. Signed-in customers and pujaris
                are not asked.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">Registration and sign-in</h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {view.configurable.map((item) => {
                  const id = `captcha-${item.feature}`;
                  return (
                    <li key={item.feature} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <label htmlFor={id} className="font-medium text-foreground">
                          {item.label}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {item.updated_by_name
                            ? `Changed by ${item.updated_by_name}, ${when(item.updated_at)}`
                            : "Default (on)"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.enabled ? "On" : "Off"}</span>
                        <Switch
                          id={id}
                          checked={item.enabled}
                          disabled={saving !== null}
                          onCheckedChange={(on) => void toggle(item, on)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                Admin and Super Admin sign-in never shows a CAPTCHA.
              </p>
            </section>

            {view.history.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Recent changes
                </h3>
                <ul className="space-y-1 text-sm">
                  {view.history.slice(0, 10).map((row, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="text-foreground">{row.reason.replace("->", "→")}</span> by {row.actor_name}, {when(row.created_at)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
