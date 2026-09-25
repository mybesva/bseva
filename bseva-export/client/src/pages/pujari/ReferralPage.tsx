import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { sharePujariReferral } from "@/lib/pujariReferralShare";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { Copy, Loader2, Share2 } from "lucide-react";

export default function PujariReferralPage() {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const [myReferrals, setMyReferrals] = useState<{ name: string; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ referral_code: string; my_referrals?: { name: string; status?: string }[] }>("/pujari/referral-code")
      .then((r) => {
        setCode(r.referral_code);
        setMyReferrals(r.my_referrals || []);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PujariPortal>
      <h1 className="text-h1 mb-2">{t("nav.referral")}</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        {t("web.referral.description")}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">{t("rewards.yourCode")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-semibold tracking-wide text-foreground">{code || "—"}</p>
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
                  void sharePujariReferral(code)
                    .then((how) => {
                      if (how === "copied") toast.success(t("rewards.shareCopied"));
                    })
                    .catch((e: unknown) => {
                      if (e instanceof Error && e.name === "AbortError") return;
                      toast.error(e instanceof Error ? e.message : t("web.referral.shareFailed"));
                    });
                }}
              >
                <Share2 className="h-4 w-4" />
                {t("rewards.share")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t("web.referral.rewardHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("web.referral.myReferrals")}</CardTitle>
            </CardHeader>
            <CardContent>
              {myReferrals.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("web.referral.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("auth.name")}</TableHead>
                      <TableHead>{t("web.booking.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myReferrals.map((r, i) => {
                      const status = String(r.status || "");
                      const statusLabel = status ? t(`status.${status}`) : "";
                      const shown = statusLabel.startsWith("status.") ? status : statusLabel;
                      return (
                        <TableRow key={`${r.name}-${i}`}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{shown || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PujariPortal>
  );
}
