/** Shared service catalog image helper — DB-driven, one default placeholder. */
import { apiBase } from "@/lib/api";

export const DEFAULT_SERVICE_IMAGE = "/images/puja-thali.png";

export function serviceImageUrl(
  svc: {
    image_url?: string | null;
    image_path?: string | null;
  } | null | undefined,
  opts?: { cacheBust?: string | number | null }
): string {
  const raw = (svc?.image_url || svc?.image_path || "").trim();
  let url = DEFAULT_SERVICE_IMAGE;
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
      url = DEFAULT_SERVICE_IMAGE;
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
