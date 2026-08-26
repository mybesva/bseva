import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
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

export default function PujariAddressPage() {
  const [value, setValue] = useState<AddressValue>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...value,
          present_address: [value.address_line1, value.address_line2, value.city, value.state, value.pincode]
            .filter(Boolean)
            .join(", "),
        }),
      });
      toast.success("Address saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PujariPortal>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="font-heading">Address</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <form className="space-y-6" onSubmit={save}>
              <AddressFields value={value} onChange={setValue} />
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
