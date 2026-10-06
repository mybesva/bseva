/** Shared service catalog image helper — DB-driven, one default placeholder. */
import { apiBase } from "@/lib/api";

export const DEFAULT_SERVICE_IMAGE = "/images/puja-thali.png";

/** Placeholder per seva type, used only when the service has no image of its own. */
const TYPE_DEFAULT_IMAGE: Partial<Record<string, string>> = {
  chadhava: "/images/seva/chadhava-offering.webp",
  pravachan: "/images/seva/pravachan-discourse.webp",
};

export function serviceImageUrl(
  svc: {
    image_url?: string | null;
    image_path?: string | null;
    service_type?: string | null;
  } | null | undefined,
  opts?: { cacheBust?: string | number | null }
): string {
  const raw = (svc?.image_url || svc?.image_path || "").trim();
  const fallback = (svc?.service_type && TYPE_DEFAULT_IMAGE[svc.service_type]) || DEFAULT_SERVICE_IMAGE;
  let url = fallback;
  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      url = raw;
    } else if (raw.startsWith("/api/")) {
      const base = apiBase();
      url = base ? `${base}${raw}` : raw;
    } else if (raw.startsWith("/")) {
      url = raw;
    } else if (raw.startsWith("services/")) {
      // Storage key alone — public catalog uses image_url; fall back to placeholder
      url = fallback;
    } else {
      url = `/${raw.replace(/^\.\//, "")}`;
    }
  }
  if (opts?.cacheBust != null && opts.cacheBust !== "") {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${opts.cacheBust}`;
  }
  return url;
}
