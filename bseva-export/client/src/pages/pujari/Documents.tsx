import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "wouter";
import { toast } from "sonner";
import PriestOnboardingPanel from "@/components/PriestOnboardingPanel";

export default function PujariDocumentsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    api<any[]>("/pujari/official-documents")
      .then(setRows)
      .catch((e) => toast.error(e.message));
  }, []);

  return (
    <PujariPortal>
      <div className="max-w-3xl space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">{t("pujari.docs.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((d) => (
                <div key={d.document_type} className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-4">
                  <div>
                    <div className="font-medium">{t("pujari.angikara.title")}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.updated_at ? new Date(d.updated_at).toLocaleString() : "—"}
                    </div>
                  </div>
                  <Badge>{t(`pujari.status.${d.status}`) || d.status}</Badge>
                  <div className="flex gap-2">
                    <Link href="/pujari/angikara">
                      <Button size="sm" variant="outline">{t("common.view")}</Button>
                    </Link>
                    <Link href="/pujari/profile">
                      <Button size="sm" variant="outline">{t("common.edit")}</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      {t("pujari.angikara.print")}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <PriestOnboardingPanel />
      </div>
    </PujariPortal>
  );
}
