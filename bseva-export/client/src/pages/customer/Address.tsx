import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import AddressFields, { type AddressValue } from "@/components/AddressFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { validateAddress } from "@/lib/fieldValidation";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import type { CustomerAddress } from "@bseva/types";
import { formatAddressLines } from "@bseva/validation";

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

function toFormValue(addr: CustomerAddress): AddressValue {
  return {
    address_line1: addr.address_line1 || "",
    address_line2: addr.address_line2 || "",
    city: addr.city || "",
    district: addr.district || "",
    state: addr.state || "",
    pincode: addr.pincode || "",
    country: addr.country || "India",
    location_label: addr.location_label || "",
    latitude: addr.latitude ?? null,
    longitude: addr.longitude ?? null,
  };
}

export default function CustomerAddressPage() {
  const { t } = useI18n();
  const { refresh } = useServiceAvailability();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gstin, setGstin] = useState("");
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState<AddressValue>(empty);

  async function loadAll() {
    setLoading(true);
    try {
      const [list, profile] = await Promise.all([
        api<CustomerAddress[]>("/customer/addresses"),
        api<{ gstin?: string | null }>("/customer/profile"),
      ]);
      setAddresses(Array.isArray(list) ? list : []);
      setGstin(String(profile.gstin || ""));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function startAdd() {
    setEditId(null);
    setLabel("");
    setValue(empty);
    setMode("add");
  }

  function startEdit(addr: CustomerAddress) {
    setEditId(addr.id);
    setLabel(String(addr.label || ""));
    setValue(toFormValue(addr));
    setMode("edit");
  }

  function cancelForm() {
    setMode("list");
    setEditId(null);
    setLabel("");
    setValue(empty);
  }

  async function saveGstin() {
    try {
      await api("/customer/profile", {
        method: "PATCH",
        body: JSON.stringify({ gstin: gstin.trim() || null }),
      });
      toast.success(t("common.save"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
    }
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAddress(value);
    if (Object.keys(errs).length) {
      toast.error(t(Object.values(errs)[0]));
      return;
    }
    if (value.latitude == null || value.longitude == null) {
      toast.error(t("errors.addressRequired"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...value,
        label: label.trim() || null,
        location_label:
          value.location_label?.trim() ||
          formatAddressLines(value),
      };
      if (mode === "edit" && editId) {
        await api(`/customer/addresses/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/customer/addresses", { method: "POST", body: JSON.stringify(body) });
      }
      await refresh({ lat: value.latitude, lng: value.longitude });
      toast.success(t("address.saved"));
      cancelForm();
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress(id: string) {
    if (!window.confirm(t("address.deleteConfirm"))) return;
    try {
      await api(`/customer/addresses/${id}`, { method: "DELETE" });
      toast.success(t("common.save"));
      if (editId === id) cancelForm();
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
    }
  }

  return (
    <CustomerPortal>
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{t("customer.myAddress")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("address.useSaved")}</p>
            </div>
            {mode === "list" ? (
              <Button type="button" onClick={startAdd}>
                {t("address.addAddress")}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">{t("common.loading")}</p>
            ) : mode === "list" ? (
              addresses.length === 0 ? (
                <p className="text-muted-foreground">{t("address.noSaved")}</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="rounded-lg border border-border p-4 space-y-2">
                      {addr.label ? <p className="font-semibold">{addr.label}</p> : null}
                      <p className="text-sm whitespace-pre-wrap">
                        {[
                          addr.address_line1,
                          addr.address_line2,
                          addr.city,
                          addr.district,
                          `${addr.city ? `${addr.city}, ` : ""}${addr.state || ""}${addr.pincode ? ` - ${addr.pincode}` : ""}`.replace(/^,\s*/, ""),
                          addr.country || "India",
                        ]
                          .filter(Boolean)
                          .join("\n")}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(addr)}>
                          {t("address.editAddress")}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => void removeAddress(addr.id)}>
                          {t("address.deleteAddress")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <form className="space-y-6" onSubmit={saveAddress}>
                <div className="space-y-1">
                  <Label htmlFor="address-label">{t("address.shortName")}</Label>
                  <Input
                    id="address-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t("address.labelPlaceholder")}
                  />
                </div>
                <AddressFields value={value} onChange={setValue} />
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? t("web.customerProfile.saving") : t("address.saveAddress")}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GSTIN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="customer-gstin">GSTIN (optional)</Label>
              <Input
                id="customer-gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="If you need GST on invoices"
                maxLength={15}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void saveGstin()}>
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </CustomerPortal>
  );
}
