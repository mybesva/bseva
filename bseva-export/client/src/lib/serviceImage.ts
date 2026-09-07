/** Shared service catalog image helper — DB-driven, one default placeholder. */
import { apiBase } from "@/lib/api";

export const DEFAULT_SERVICE_IMAGE = "/images/puja-thali.png";

export function serviceImageUrl(svc: {
  image_url?: string | null;
  image_path?: string | null;
} | null | undefined): string {
  const raw = (svc?.image_url || svc?.image_path || "").trim();
  if (!raw) return DEFAULT_SERVICE_IMAGE;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // API-hosted uploads (admin) — prefix API origin in local/dev when needed
  if (raw.startsWith("/api/")) {
    const base = apiBase();
    return base ? `${base}${raw}` : raw;
  }
  if (raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\.\//, "")}`;
}
