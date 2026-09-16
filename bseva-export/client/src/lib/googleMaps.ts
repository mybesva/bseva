const MAPS_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.VITE_FRONTEND_FORGE_API_KEY as string | undefined);

const FORGE_BASE =
  (import.meta.env.VITE_FRONTEND_FORGE_API_URL as string | undefined) ||
  "https://forge.butterfly-effect.dev";

export function googleMapsBrowserKey(): string {
  return (MAPS_KEY || "").trim();
}

let mapsLoadPromise: Promise<void> | null = null;

export function loadGoogleMaps(libraries = "places,geocoding,geometry"): Promise<void> {
  if (typeof window !== "undefined" && window.google?.maps) {
    return Promise.resolve();
  }
  if (mapsLoadPromise) return mapsLoadPromise;
  const key = googleMapsBrowserKey();
  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    if (!key) {
      mapsLoadPromise = null;
      reject(new Error("Maps API key not configured"));
      return;
    }
    const existing = document.querySelector('script[data-bseva-maps="1"]') as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          mapsLoadPromise = null;
          reject(new Error("Failed to load maps"));
        },
        { once: true },
      );
      return;
    }
    const src = key.startsWith("AIza")
      ? `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=${libraries}&v=weekly`
      : `${FORGE_BASE}/v1/maps/proxy/maps/api/js?key=${encodeURIComponent(key)}&libraries=${libraries}&v=weekly`;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.bsevaMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Failed to load maps"));
    };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

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

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}
