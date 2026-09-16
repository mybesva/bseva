import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import AddressFields, { type AddressValue } from "@/components/AddressFields";
import PujariOnboardingWalkthrough, { usePujariOnboardingGate } from "@/components/PujariOnboardingWalkthrough";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { validateAddress } from "@/lib/fieldValidation";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

const empty: AddressValue = {
  address_line1: "",
  address_line2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  country: "India",
  location_label: "",
  latitude: null,
  longitude: null,
};

export default function PujariAddressPage() {
  const { t } = useI18n();
  const { active: onboardingActive } = usePujariOnboardingGate("address");
  const [value, setValue] = useState<AddressValue>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [walkthroughErrors, setWalkthroughErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setValue({
          address_line1: p.address_line1 || "",
          address_line2: p.address_line2 || "",
          city: p.city || "",
          district: p.district || "",
          state: p.state || "",
          pincode: p.pincode || "",
          country: p.country || "India",
          location_label: p.location_label || "",
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
        });
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function persistAddressDraft(): Promise<boolean> {
    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...value,
          present_address: [value.address_line1, value.address_line2, value.city, value.district, value.state, value.pincode]
            .filter(Boolean)
            .join(", "),
        }),
      });
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress(): Promise<boolean> {
    const errs = validateAddress(value);
    if (Object.keys(errs).length) {
      toast.error(t(Object.values(errs)[0]));
      return false;
    }
    if (!(await persistAddressDraft())) return false;
    toast.success(t("address.saved"));
    return true;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (onboardingActive) return;
    await saveAddress();
  }

  return (
    <PujariPortal>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="">{t("address.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <form className="space-y-6" onSubmit={save}>
              <AddressFields value={value} onChange={setValue} />
              {!onboardingActive ? (
                <Button type="submit" disabled={saving}>
                  {saving ? t("web.common.saving") : t("common.save")}
                </Button>
              ) : null}
              <PujariOnboardingWalkthrough
                page="address"
                saving={saving}
                fieldErrors={walkthroughErrors}
                onFieldErrors={setWalkthroughErrors}
                beforeContinue={persistAddressDraft}
              />
            </form>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
