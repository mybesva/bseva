import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import AddressFields, { type AddressValue } from "@/components/AddressFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
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
  const [value, setValue] = useState<AddressValue>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value.district.trim()) {
      toast.error("District is required");
      return;
    }
    setSaving(true);
    try {
      await api("/customer/profile", {
        method: "PATCH",
        body: JSON.stringify(value),
      });
      toast.success("Address saved");
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
          <CardTitle className="font-heading">My Address</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <form className="space-y-6" onSubmit={save}>
              <AddressFields value={value} onChange={setValue} />
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
