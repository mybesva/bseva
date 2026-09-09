import { addressSchema } from "@bseva/validation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { AddressForm, type AddressFormValue } from "@/components/AddressForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function PujariAddress() {
  const q = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const [form, setForm] = useState<AddressFormValue>({
    address_line1: "",
    address_line2: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setForm({
      address_line1: String(q.data.address_line1 || ""),
      address_line2: String(q.data.address_line2 || ""),
      city: String(q.data.city || ""),
      district: String(q.data.district || ""),
      state: String(q.data.state || ""),
      pincode: String(q.data.pincode || ""),
      country: String(q.data.country || "India"),
      location_label: String(q.data.location_label || ""),
      latitude: q.data.latitude != null ? Number(q.data.latitude) : undefined,
      longitude: q.data.longitude != null ? Number(q.data.longitude) : undefined,
    });
  }, [q.data]);
  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Address" back />
        <LoadingBlock />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader title="Address" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <AddressForm
          value={form}
          onChange={setForm}
          busy={busy}
          onSave={async (parsed) => {
            const check = addressSchema.safeParse(parsed);
            if (!check.success) {
              setError(check.error.issues[0]?.message || "Check address");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await apiClient.patchPujariProfile({
                ...parsed,
                present_address: [parsed.address_line1, parsed.city, parsed.state, parsed.pincode].filter(Boolean).join(", "),
              });
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
