import { addressSchema } from "@bseva/validation";
import * as Location from "expo-location";
import { useState } from "react";
import { View } from "react-native";
import { AppText, ErrorBanner, Field, PrimaryButton } from "./ui";

export type AddressFormValue = {
  address_line1: string;
  address_line2?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country?: string;
  location_label?: string;
  latitude?: number;
  longitude?: number;
};

export function AddressForm({
  value,
  onChange,
  onSave,
  busy,
}: {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
  onSave: (parsed: AddressFormValue) => Promise<void>;
  busy?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  function set<K extends keyof AddressFormValue>(key: K, v: AddressFormValue[K]) {
    onChange({ ...value, [key]: v });
  }
  return (
    <View style={{ gap: 10 }}>
      <ErrorBanner message={error} />
      <Field label="Address line 1" value={value.address_line1} onChangeText={(v) => set("address_line1", v)} />
      <Field label="Address line 2" value={value.address_line2 || ""} onChangeText={(v) => set("address_line2", v)} />
      <Field label="City" value={value.city} onChangeText={(v) => set("city", v)} />
      <Field label="District" value={value.district} onChangeText={(v) => set("district", v)} />
      <Field label="State" value={value.state} onChangeText={(v) => set("state", v)} />
      <Field label="Pincode" value={value.pincode} onChangeText={(v) => set("pincode", v)} keyboardType="number-pad" />
      <Field label="Country" value={value.country || "India"} onChangeText={(v) => set("country", v)} />
      <Field label="Location label" value={value.location_label || ""} onChangeText={(v) => set("location_label", v)} />
      {value.latitude != null ? (
        <AppText variant="small">
          GPS: {value.latitude.toFixed(5)}, {value.longitude?.toFixed(5)}
        </AppText>
      ) : null}
      <PrimaryButton
        title="Use current location"
        variant="outline"
        onPress={async () => {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setError("Location permission denied");
            return;
          }
          const pos = await Location.getCurrentPositionAsync({});
          onChange({
            ...value,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }}
      />
      <PrimaryButton
        title={busy ? "Saving..." : "Save address"}
        loading={busy}
        onPress={async () => {
          const parsed = addressSchema.safeParse({ ...value, country: value.country || "India" });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message || "Check address");
            return;
          }
          setError(null);
          await onSave({
            ...parsed.data,
            latitude: value.latitude,
            longitude: value.longitude,
            location_label: parsed.data.location_label || parsed.data.city,
          });
        }}
      />
    </View>
  );
}
