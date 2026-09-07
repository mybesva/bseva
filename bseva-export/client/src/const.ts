export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Obscure admin UI base path (not linked publicly).
 * Override with VITE_ADMIN_PATH in local `.env` and Vercel (build-time).
 * Must not be `/admin`.
 */
const DEFAULT_ADMIN_UI_PATH = "/bseva-ops-m8k4q";

export function adminBasePath(): string {
  const raw = String(import.meta.env.VITE_ADMIN_PATH || DEFAULT_ADMIN_UI_PATH).trim();
  let p = raw.startsWith("/") ? raw : `/${raw}`;
  p = p.replace(/\/+$/, "") || DEFAULT_ADMIN_UI_PATH;
  if (p === "/admin" || p.startsWith("/admin/")) return DEFAULT_ADMIN_UI_PATH;
  return p;
}

/** Build an admin UI path, e.g. adminPath("/customers") → `/bseva-ops-…/customers` */
export function adminPath(subpath = ""): string {
  const base = adminBasePath();
  if (!subpath || subpath === "/") return base;
  const s = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return `${base}${s}`;
}

export function isAdminUiPath(pathname: string): boolean {
  const base = adminBasePath();
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Login URL; pass returnPath to continue booking after auth. */
export function getLoginUrl(opts?: { role?: string; returnPath?: string }) {
  const params = new URLSearchParams();
  if (opts?.role) params.set("role", opts.role);
  if (opts?.returnPath) params.set("returnUrl", opts.returnPath);
  const q = params.toString();
  return q ? `/login?${q}` : "/login";
}

export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Only allow same-origin relative paths
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
