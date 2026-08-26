import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import PujariLevelApply from "@/components/PujariLevelApply";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function PujariServicesPage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api<any>("/pujari/profile")
      .then(setProfile)
      .catch((e) => toast.error(e.message));
  }, []);

  const requested = Number(profile?.requested_level || 0);
  const pendingUpgrade = requested > Number(profile?.approved_level || 0);

  return (
    <PujariPortal>
      <Card className="max-w-2xl border-border shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="font-heading text-2xl">{t("pujari.level.upgradePageTitle")}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{t("pujari.level.hint")}</CardDescription>
          <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p>{t("pujari.level.adminReview")}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <PujariLevelApply
                approvedLevel={profile.approved_level}
                requestedLevel={profile.requested_level}
                onUpdated={setProfile}
                upgradeOnly
                hideHeader
              />
              {pendingUpgrade && (
                <p className="text-sm text-muted-foreground rounded-md border p-3 bg-secondary/30">
                  Your upgrade request for {t(`pujari.level.l${requested}`)} is under review. Bookings
                  continue at your current approved level until BSeva admin approves the change.
                </p>
              )}
              {!profile.approved_level && (
                <p className="text-sm text-muted-foreground rounded-md border border-amber-100 bg-amber-50 p-3">
                  No approved role yet. Submit your request above — admin will verify your documents and assign
                  your level.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
