import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, apiBase, getToken, rupees } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

export default function CustomerInvoicesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    api<any[]>("/invoices")
      .then(setRows)
      .catch((e) => toast.error(e.message));
  }, []);

  async function openHtml(inv: any) {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/v1/invoices/${inv.id}/html`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const html = await res.text();
      const w = window.open("", "_blank");
      if (!w) {
        toast.error(t("invoice.popupBlocked"));
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (e: any) {
      toast.error(e.message || t("invoice.openFailed"));
    }
  }

  return (
    <CustomerPortal>
      <h1 className="text-2xl font-heading font-bold mb-4">{t("invoice.title")}</h1>
      <div className="space-y-3 max-w-2xl">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("invoice.empty")}</p>}
        {rows.map((inv) => (
          <Card key={inv.id}>
            <CardHeader className="py-3">
              <CardTitle className="text-base font-heading flex justify-between gap-2">
                <span>{inv.invoice_number}</span>
                <span>{rupees(inv.total_paise)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                {t("invoice.type")}: {inv.invoice_type}
              </div>
              <div>
                {t("invoice.created")}: {inv.created_at}
              </div>
              <Button size="sm" variant="outline" onClick={() => void openHtml(inv)}>
                {t("invoice.viewPrint")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </CustomerPortal>
  );
}
