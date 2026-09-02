export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

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
