import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, pujariMediaUrl } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "wouter";
import { toast } from "sonner";

const QUAL_LABEL: Record<string, string> = {
  panchadasha: "pujari.q1",
  kriya_kovida: "pujari.q2",
  vidya_visharada: "pujari.q3",
};

function Row({ label, value }: { label: string; value?: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 py-2 border-b">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="md:col-span-2 text-sm font-medium whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}

export default function AngikaraPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [sign, setSign] = useState<string | null>(null);

  async function load() {
    const out = await api<any>("/pujari/angikara");
    setData(out.profile);
    if (out.profile?.profile_photo_path) setPhoto(await pujariMediaUrl("photo"));
    if (out.profile?.signature_path) setSign(await pujariMediaUrl("signature"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  if (!data) return null;
  const locked = data.angikara?.status === "submitted" || data.angikara?.status === "approved";
  const source = locked && data.angikara?.snapshot ? { ...data, ...data.angikara.snapshot } : data;
  const quals = (source.qualifications || []).map((id: string) => t(QUAL_LABEL[id] || id)).join(", ");

  return (
    <PujariPortal>
      <div className="max-w-3xl print:max-w-none">
          <Card className="print:shadow-none print:border">
            <CardContent className="p-8 space-y-4">
              <div className="text-center space-y-1">
                <h1 className="font-heading text-xl font-bold">{t("pujari.angikara.header")}</h1>
                <p className="text-sm text-muted-foreground">{t("pujari.angikara.address")}</p>
                <h2 className="font-heading text-2xl mt-4">{t("pujari.angikara.formTitle")}</h2>
              </div>
              {photo && <img src={photo} alt="" className="h-28 w-28 object-cover rounded-md mx-auto border" />}
              <Row label={t("pujari.fullName")} value={source.full_name} />
              <Row label={t("pujari.fatherName")} value={source.father_name} />
              <Row label={t("pujari.gotra")} value={source.gotra} />
              <Row label={t("pujari.dob")} value={source.date_of_birth} />
              <Row label={t("pujari.native")} value={source.native_place} />
              <Row label={t("pujari.permanent")} value={source.permanent_address} />
              <Row label={t("pujari.present")} value={source.present_address} />
              <Row label={t("pujari.mobile")} value={source.mobile_number} />
              <Row label={t("pujari.whatsapp")} value={source.whatsapp_number} />
              <Row label={t("pujari.qualification")} value={quals} />
              <Row label={t("pujari.year")} value={source.qualification_year} />
              <Row label={t("pujari.sampradaya")} value={source.sampradaya ? t(`pujari.${source.sampradaya}`) : ""} />
              <Row label={t("pujari.consent")} value={source.website_publication_consent ? "Yes" : "No"} />
              <div>
                <div className="text-sm text-muted-foreground mb-1">{t("pujari.signature")}</div>
                {sign ? <img src={sign} alt="" className="h-16 border bg-white" /> : "—"}
              </div>
              <div className="flex flex-wrap gap-2 print:hidden pt-4">
                <Link href="/pujari/profile">
                  <Button variant="outline">{t("pujari.profile.edit")}</Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => api("/pujari/profile", { method: "PATCH", body: JSON.stringify({}) }).then(() => toast.success(t("common.save")))}
                >
                  {t("common.save")}
                </Button>
                <Button
                  disabled={locked}
                  onClick={async () => {
                    try {
                      await api("/pujari/angikara/submit", { method: "POST" });
                      toast.success(t("pujari.angikara.submit"));
                      await load();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  {t("pujari.angikara.submit")}
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  {t("pujari.angikara.print")}
                </Button>
              </div>
            </CardContent>
          </Card>
      </div>
    </PujariPortal>
  );
}
