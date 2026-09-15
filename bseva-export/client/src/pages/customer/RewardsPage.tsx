import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, rupees } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { Copy, Share2 } from "lucide-react";
import { shareCustomerReferral } from "@/lib/customerReferralShare";

export default function CustomerRewardsPage() {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const [myReferrals, setMyReferrals] = useState<{ name: string }[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);

  async function load() {
    const ref = await api<{ referral_code: string; my_referrals?: { name: string }[] }>("/customer/referral-code");
    setCode(ref.referral_code);
    setMyReferrals(ref.my_referrals || []);
    setRewards(await api<any[]>("/wallet/rewards"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  return (
    <CustomerPortal>
      <h1 className="text-h1 mb-4">{t("rewards.title")}</h1>
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rewards.yourCode")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-semibold tracking-wide">{code || "…"}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!code}
                aria-label={t("rewards.copy")}
                title={t("rewards.copy")}
                onClick={() => {
                  if (!code) return;
                  void navigator.clipboard.writeText(code);
                  toast.success(t("rewards.copied"));
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              className="gap-2"
              disabled={!code}
              onClick={() => {
                if (!code) return;
                void shareCustomerReferral(code)
                  .then((how) => {
                    if (how === "copied") toast.success(t("rewards.shareCopied"));
                  })
                  .catch((e: unknown) => {
                    if (e instanceof Error && e.name === "AbortError") return;
                    toast.error(e instanceof Error ? e.message : "Could not share");
                  });
              }}
            >
              <Share2 className="h-4 w-4" />
              {t("rewards.share")}
            </Button>
            <p className="text-sm text-muted-foreground">{t("rewards.shareHint")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {myReferrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has joined with your code yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myReferrals.map((r, i) => (
                    <TableRow key={`${r.name}-${i}`}>
                      <TableCell>{r.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("rewards.history")}</CardTitle>
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
