import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { AddressForm, type AddressFormValue } from "@/components/AddressForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function CustomerAddress() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, string | number | null>>,
  });
  const [form, setForm] = useState<AddressFormValue>({
    address_line1: "",
    address_line2: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    country: "India",
    location_label: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    const p = q.data;
    setForm({
      address_line1: String(p.address_line1 || p.address || ""),
      address_line2: String(p.address_line2 || ""),
      city: String(p.city || ""),
      district: String(p.district || ""),
      state: String(p.state || ""),
      pincode: String(p.pincode || ""),
      country: String(p.country || "India"),
      location_label: String(p.location_label || ""),
      gstin: String(p.gstin || ""),
      latitude: p.latitude != null ? Number(p.latitude) : undefined,
      longitude: p.longitude != null ? Number(p.longitude) : undefined,
    });
  }, [q.data]);

  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.address")} back />
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t("mobile.address")} back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <AddressForm
          value={form}
          onChange={setForm}
          busy={busy}
          includeGstin
          onSave={async (parsed) => {
            setBusy(true);
            setError(null);
            try {
              await apiClient.patchCustomerProfile({
                ...parsed,
                address: [parsed.address_line1, parsed.city].filter(Boolean).join(", "),
              });
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
