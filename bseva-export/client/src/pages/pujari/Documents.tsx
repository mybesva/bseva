import { PujariPortal } from "@/components/RolePortals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import PriestOnboardingPanel from "@/components/PriestOnboardingPanel";

export default function PujariDocumentsPage() {
  const { t } = useI18n();

  return (
    <PujariPortal>
      <div className="max-w-3xl space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="">{t("pujari.docs.title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Personal and professional details (including experience) are saved in{" "}
            <a href="/pujari/profile" className="text-primary underline">
              My Profile
            </a>
            . Upload KYC documents below.
          </CardContent>
        </Card>
        <PriestOnboardingPanel />
      </div>
    </PujariPortal>
  );
}
