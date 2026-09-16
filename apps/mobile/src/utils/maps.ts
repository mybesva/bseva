import { Linking, Platform } from "react-native";

export function mapsSearchUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapsDirectionsUrl(opts: {
  originLat?: number | null;
  originLng?: number | null;
  destLat: number;
  destLng: number;
}) {
  const dest = `${opts.destLat},${opts.destLng}`;
  if (opts.originLat != null && opts.originLng != null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${opts.originLat},${opts.originLng}&destination=${dest}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export async function openMapsSearch(lat: number, lng: number) {
  const geo =
    Platform.OS === "ios"
      ? `maps:0,0?q=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}`;
  try {
    const can = await Linking.canOpenURL(geo);
    await Linking.openURL(can ? geo : mapsSearchUrl(lat, lng));
  } catch {
    await Linking.openURL(mapsSearchUrl(lat, lng));
  }
}

export async function openMapsDirections(opts: {
  originLat?: number | null;
  originLng?: number | null;
  destLat: number;
  destLng: number;
}) {
  const dest = `${opts.destLat},${opts.destLng}`;
  const native =
    Platform.OS === "ios"
      ? opts.originLat != null && opts.originLng != null
        ? `maps://?saddr=${opts.originLat},${opts.originLng}&daddr=${dest}&dirflg=d`
        : `maps://?daddr=${dest}&dirflg=d`
      : `google.navigation:q=${dest}`;
  try {
    const can = await Linking.canOpenURL(native);
    await Linking.openURL(can ? native : mapsDirectionsUrl(opts));
  } catch {
    await Linking.openURL(mapsDirectionsUrl(opts));
  }
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}
