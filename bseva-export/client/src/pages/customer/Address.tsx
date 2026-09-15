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

export default function CustomerAddressPage() {
  const { refresh } = useServiceAvailability();
  const [value, setValue] = useState<AddressValue>(empty);
  const [loading, setLoading] = useState(true);
  const [gstin, setGstin] = useState("");

  useEffect(() => {
    setLoading(true);
    api<any>("/customer/profile")
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
        setGstin(String(p.gstin || ""));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAddress(value);
    if (Object.keys(errs).length) {
      toast.error(Object.values(errs)[0]);
      return;
    }
    if (value.latitude == null || value.longitude == null) {
      toast.error("Please set your location on the map (search, current location, or drag the pin)");
      return;
    }
    setSaving(true);
    try {
      await api("/customer/profile", {
        method: "PATCH",
        body: JSON.stringify({ ...value, gstin: gstin.trim() || null }),
      });
      await refresh({ lat: value.latitude, lng: value.longitude });
      toast.success("Address saved — service availability updated for this location");
    } catch (err: any) {
      toast.error(err.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CustomerPortal>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="">My Address</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This is your default service location and billing address for invoices. Booking availability is
            checked using the map pin here.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <form className="space-y-6" onSubmit={save}>
              <AddressFields value={value} onChange={setValue} />
              <div className="space-y-1">
                <Label htmlFor="customer-gstin">GSTIN (optional)</Label>
                <Input
                  id="customer-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="If you need GST on invoices"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">
                  Shown on your tax invoice only if you provide a GSTIN. Used with this billing address.
                </p>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save address"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
