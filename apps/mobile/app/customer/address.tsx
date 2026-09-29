import type { CustomerAddress } from "@bseva/types";
import { formatAddressLines } from "@bseva/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { AddressForm, type AddressFormValue } from "@/components/AddressForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { showSuccessAlert } from "@/utils/actionFeedback";
import { useAppTheme } from "@/theme/ThemeContext";

const emptyForm: AddressFormValue = {
  address_line1: "",
  address_line2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  country: "India",
  location_label: "",
};

function toFormValue(addr: CustomerAddress): AddressFormValue {
  return {
    address_line1: String(addr.address_line1 || ""),
    address_line2: String(addr.address_line2 || ""),
    city: String(addr.city || ""),
    district: String(addr.district || ""),
    state: String(addr.state || ""),
    pincode: String(addr.pincode || ""),
    country: String(addr.country || "India"),
    location_label: String(addr.location_label || ""),
    latitude: addr.latitude != null ? Number(addr.latitude) : undefined,
    longitude: addr.longitude != null ? Number(addr.longitude) : undefined,
  };
}

function formatCardBody(addr: CustomerAddress) {
  const lines = [
    addr.address_line1,
    addr.address_line2,
    [addr.city, addr.district].filter(Boolean).join(", ") || null,
    [addr.city, addr.state, addr.pincode].filter(Boolean).length
      ? `${addr.city ? `${addr.city}, ` : ""}${addr.state || ""}${addr.pincode ? ` - ${addr.pincode}` : ""}`.replace(/^,\s*/, "")
      : null,
    addr.country || "India",
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return lines.join("\n");
}

export default function CustomerAddress() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const addressesQ = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => apiClient.listCustomerAddresses(),
  });
  const profileQ = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, string | number | null>>,
  });
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [form, setForm] = useState<AddressFormValue>(emptyForm);
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addresses = addressesQ.data || [];

  useEffect(() => {
    if (!profileQ.data) return;
    setGstin(String(profileQ.data.gstin || ""));
  }, [profileQ.data]);

  function startAdd() {
    setEditId(null);
    setLabel("");
    setForm(emptyForm);
    setMode("add");
    setError(null);
  }

  function startEdit(addr: CustomerAddress) {
    setEditId(addr.id);
    setLabel(String(addr.label || ""));
    setForm(toFormValue(addr));
    setMode("edit");
    setError(null);
  }

  function cancelForm() {
    setMode("list");
    setEditId(null);
    setLabel("");
    setForm(emptyForm);
    setError(null);
  }

  async function saveGstin() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.patchCustomerProfile({ gstin: gstin.trim() || null });
      await profileQ.refetch();
      showSuccessAlert(t("mobile.save"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(addr: CustomerAddress) {
    Alert.alert(t("address.deleteAddress"), t("address.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("address.deleteAddress"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await apiClient.deleteCustomerAddress(addr.id);
              if (editId === addr.id) cancelForm();
              await addressesQ.refetch();
              await qc.invalidateQueries({ queryKey: ["service-availability"] });
              showSuccessAlert(t("mobile.save"));
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (addressesQ.isLoading) {
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
        {mode === "list" ? (
          <>
            <PrimaryButton title={t("address.addAddress")} onPress={startAdd} />
            <View style={{ height: 16 }} />
            {addresses.length === 0 ? (
              <AppText color={colors.mutedForeground}>{t("address.noSaved")}</AppText>
            ) : (
              addresses.map((addr) => (
                <Card key={addr.id} style={{ marginBottom: 12, gap: 8 }}>
                  {addr.label ? <AppText style={{ fontWeight: "700" }}>{addr.label}</AppText> : null}
                  <AppText>{formatCardBody(addr)}</AppText>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <PrimaryButton title={t("address.editAddress")} variant="outline" onPress={() => startEdit(addr)} />
                    <PrimaryButton
                      title={t("address.deleteAddress")}
                      variant="outline"
                      onPress={() => confirmDelete(addr)}
                    />
                  </View>
                </Card>
              ))
            )}
            <View style={{ height: 20 }} />
            <AppText variant="small" style={{ marginBottom: 8 }}>
              GSTIN (optional)
            </AppText>
            <Field
              label="GSTIN (optional)"
              value={gstin}
              onChangeText={setGstin}
              placeholder="If you need GST on invoices"
              autoCapitalize="characters"
            />
            <View style={{ height: 8 }} />
            <PrimaryButton
              title={busy ? t("mobile.saving") : t("common.save")}
              loading={busy}
              variant="outline"
              onPress={() => void saveGstin()}
            />
          </>
        ) : (
          <>
            <Field
              label={t("address.shortName")}
              value={label}
              onChangeText={setLabel}
              placeholder={t("address.labelPlaceholder")}
            />
            <AddressForm
              value={form}
              onChange={setForm}
              busy={busy}
              onSave={async (parsed) => {
                setBusy(true);
                setError(null);
                try {
                  const body = {
                    ...parsed,
                    label: label.trim() || null,
                    location_label: parsed.location_label?.trim() || formatAddressLines(parsed),
                  };
                  if (mode === "edit" && editId) {
                    await apiClient.updateCustomerAddress(editId, body);
                  } else {
                    await apiClient.createCustomerAddress(body);
                  }
                  await addressesQ.refetch();
                  await qc.invalidateQueries({ queryKey: ["service-availability"] });
                  showSuccessAlert(t("mobile.addressSaved"));
                  cancelForm();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <View style={{ height: 8 }} />
            <PrimaryButton title={t("common.cancel")} variant="outline" onPress={cancelForm} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
