import { addressSchema } from "@bseva/validation";
import { useState } from "react";
import { View } from "react-native";
import { MapPinPicker } from "./MapPinPicker";
import { AppText, ErrorBanner, Field, PrimaryButton } from "./ui";
import { useI18n } from "@/providers/I18nProvider";
import { userMessage } from "@/utils/userMessage";
import { useAppTheme } from "@/theme/ThemeContext";
import {
  getDeviceCoordinates,
  LocationDisabledError,
  LocationPermissionError,
  reverseGeocodeParts,
} from "@/utils/deviceLocation";

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
  gstin?: string;
};

export function AddressForm({
  value,
  onChange,
  onSave,
  busy,
  includeGstin,
  saveLabel,
  onBack,
}: {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
  onSave: (parsed: AddressFormValue) => Promise<void>;
  busy?: boolean;
  includeGstin?: boolean;
  /** Save button text (default "Save Address"). */
  saveLabel?: string;
  /** When set, a Back button is shown next to Save (onboarding steps). */
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  function set<K extends keyof AddressFormValue>(key: K, v: AddressFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  async function useCurrentLocation() {
    setError(null);
    setLocating(true);
    try {
      const pos = await getDeviceCoordinates();
      const geo = await reverseGeocodeParts(pos.latitude, pos.longitude);
      onChange({
        ...value,
        latitude: pos.latitude,
        longitude: pos.longitude,
        city: geo?.city || value.city,
        district: geo?.district || value.district,
        state: geo?.state || value.state,
        pincode: geo?.pincode || value.pincode,
        country: geo?.country || value.country || "India",
        location_label: geo?.label || value.location_label,
        address_line1: value.address_line1 || geo?.street || value.address_line1,
      });
    } catch (e) {
      if (e instanceof LocationPermissionError) setError(t("mobile.locationPermissionDenied"));
      else if (e instanceof LocationDisabledError) setError(t("web.address.currentUnavailable"));
      else setError(t("web.address.currentFailed"));
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <ErrorBanner message={error} />
      <Field required label={t("mobile.addressLine1")} value={value.address_line1} onChangeText={(v) => set("address_line1", v)} error={fieldErrors.address_line1} />
      <Field label={t("mobile.addressLine2")} value={value.address_line2 || ""} onChangeText={(v) => set("address_line2", v)} />
      <Field required label={t("mobile.city")} value={value.city} onChangeText={(v) => set("city", v)} error={fieldErrors.city} />
      <Field required label={t("mobile.district")} value={value.district} onChangeText={(v) => set("district", v)} error={fieldErrors.district} />
      <Field required label={t("mobile.state")} value={value.state} onChangeText={(v) => set("state", v)} error={fieldErrors.state} />
      <Field required label={t("mobile.pincode")} value={value.pincode} onChangeText={(v) => set("pincode", v)} keyboardType="number-pad" error={fieldErrors.pincode} />
      <Field label={t("mobile.country")} value={value.country || "India"} onChangeText={(v) => set("country", v)} />
      <Field label={t("mobile.locationLabel")} value={value.location_label || ""} onChangeText={(v) => set("location_label", v)} />
      {includeGstin ? (
        <Field label="GSTIN (Optional)" value={value.gstin || ""} onChangeText={(v) => set("gstin", v)} autoCapitalize="characters" />
      ) : null}
      {value.latitude != null ? (
        <AppText variant="small">
          GPS: {value.latitude.toFixed(5)}, {value.longitude?.toFixed(5)}
        </AppText>
      ) : null}
      <MapPinPicker
        latitude={value.latitude}
        longitude={value.longitude}
        onChange={(lat, lng) => onChange({ ...value, latitude: lat, longitude: lng })}
      />
      <PrimaryButton
        title={t("mobile.useCurrentLocation")}
        variant="outline"
        loading={locating}
        onPress={() => void useCurrentLocation()}
      />
      {error ? <AppText variant="small" color={colors.destructive}>{error}</AppText> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
      {onBack ? (
        <View style={{ flex: 1 }}>
          <PrimaryButton title={t("common.back")} variant="outline" onPress={onBack} />
        </View>
      ) : null}
      <View style={{ flex: onBack ? 2 : 1 }}>
      <PrimaryButton
        title={busy ? t("mobile.saving") : saveLabel || t("mobile.saveAddress")}
        loading={busy}
        onPress={async () => {
          const parsed = addressSchema.safeParse({ ...value, country: value.country || "India" });
          if (!parsed.success) {
            // Highlight every invalid field, not just the first one.
            const next: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
              const key = String(issue.path[0] || "address_line1");
              if (!next[key]) next[key] = userMessage(t, issue.message, t("mobile.checkAddress")) || t("mobile.checkAddress");
            }
            setFieldErrors(next);
            setError(t("errors.validation"));
            return;
          }
          setFieldErrors({});
          if (value.latitude == null || value.longitude == null) {
            setError(t("booking.needMap"));
            return;
          }
          setError(null);
          await onSave({
            ...parsed.data,
            latitude: value.latitude,
            longitude: value.longitude,
            location_label: parsed.data.location_label || parsed.data.city,
            gstin: value.gstin?.trim() || undefined,
          });
        }}
      />
      </View>
      </View>
    </View>
  );
}
