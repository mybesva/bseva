import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, rupees } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

export default function CustomerRewardsPage() {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const [applied, setApplied] = useState<any>(null);
  const [applyCode, setApplyCode] = useState("");
  const [rewards, setRewards] = useState<any[]>([]);

  async function load() {
    const ref = await api<{ referral_code: string; applied: any }>("/customer/referral-code");
    setCode(ref.referral_code);
    setApplied(ref.applied);
    setRewards(await api<any[]>("/wallet/rewards"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  return (
    <CustomerPortal>
      <h1 className="text-2xl font-heading font-bold mb-4">{t("rewards.title")}</h1>
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{t("rewards.yourCode")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold tracking-wide">{code || "…"}</p>
            <Button
              variant="outline"
              disabled={!code}
              onClick={() => {
                if (!code) return;
                void navigator.clipboard.writeText(code);
                toast.success(t("rewards.copied"));
              }}
            >
              {t("rewards.copy")}
            </Button>
            <p className="text-sm text-muted-foreground">{t("rewards.shareHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{t("rewards.applyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {applied ? (
              <p className="text-sm">
                {t("rewards.alreadyApplied")}: <strong>{applied.code}</strong> ({applied.status})
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>{t("rewards.codeLabel")}</Label>
                  <Input value={applyCode} onChange={(e) => setApplyCode(e.target.value)} placeholder="CUST1234-RC" />
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await api("/referrals/apply", {
                        method: "POST",
                        body: JSON.stringify({ code: applyCode.trim() }),
                      });
                      toast.success(t("rewards.applyOk"));
                      await load();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  {t("rewards.apply")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-base">{t("rewards.history")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rewards.length === 0 && <p className="text-sm text-muted-foreground">{t("rewards.empty")}</p>}
            {rewards.map((r) => (
              <div key={r.id} className="flex justify-between text-sm border-b border-border py-2">
                <span>
                  {r.reward_type} · {r.status}
                </span>
                <span>{rupees(r.amount_paise)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CustomerPortal>
  );
}
