import { adminPath } from "@/const";
import { LANG_STORAGE_KEY, parseApiErrorDetail } from "@bseva/locales";

const TOKEN_KEY = "bseva_token";

/**
 * API origin:
 * - VITE_API_URL if set (local FastAPI, or future AWS URL)
 * - Vite `npm run dev` without env → http://localhost:8000
 * - production/preview build without env → "" (same-origin `/api/v1/...` on Vercel)
 */
export function apiBase() {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const fromEnv = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  if (fromEnv.length > 0) return fromEnv;
  // import.meta.env.PROD is true for `vite build` (including Vercel)
  if (import.meta.env.PROD) return "";
  return "http://localhost:8000";
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

function formatFetchError(data: unknown, res: Response, fallback: string): { message: string; code?: string } {
  const detail = (data as { detail?: unknown; message?: unknown } | null)?.detail;
  const parsed = parseApiErrorDetail(detail, "");
  if (parsed.message) return parsed;
  const top = (data as { message?: unknown } | null)?.message;
  if (typeof top === "string" && top.trim()) return { message: top };
  const statusBit = res.status ? ` (${res.status})` : "";
  if (res.statusText?.trim()) return { message: `${res.statusText}${statusBit}` };
  return { message: `${fallback}${statusBit}` };
}

function throwApiError(data: unknown, res: Response, fallback: string): never {
  const parsed = formatFetchError(data, res, fallback);
  const err = new Error(parsed.message) as Error & { code?: string };
  err.code = parsed.code;
  throw err;
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof window !== "undefined") {
    const lang = localStorage.getItem(LANG_STORAGE_KEY);
    if (lang && !headers.has("Accept-Language")) headers.set("Accept-Language", lang);
  }
  const res = await fetch(`${apiBase()}/api/v1${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throwApiError(data, res, "Request failed");
  }
  return data as T;
}

/** Bookings list is paginated: { items, total, page, limit, pages }. */
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export async function apiBookings<T = any>(
  page = 1,
  limit = 50,
  extra?: Record<string, string>,
): Promise<Paginated<T>> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) qs.set(k, v);
    }
  }
  const data = await api<Paginated<T> | T[]>(`/bookings?${qs}`);
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, limit: data.length || limit, pages: 1 };
  }
  return data;
}

export async function uploadPujariDocument(file: File, documentType: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const body = new FormData();
  body.append("file", file);
  body.append("document_type", documentType);
  const res = await fetch(`${apiBase()}/api/v1/pujari/documents/upload`, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || "Upload failed");
  return data;
}

export async function uploadPujariAsset(kind: "photo" | "signature", file: File) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const name = file.name || `${kind}.jpg`;
  const lower = name.toLowerCase();
  const hasExt = /\.(jpe?g|png|webp)$/i.test(lower);
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("File must be under 8 MB");
  }
  if (file.type && !allowed.includes(file.type) && !hasExt) {
    throw new Error("Upload a JPG, PNG or WebP image (HEIC is not supported)");
  }
  // Ensure the multipart part has a filename with extension (Safari sometimes omits it)
  let uploadFile = file;
  if (!hasExt) {
    const ext =
      file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    uploadFile = new File([file], `${kind}${ext}`, { type: file.type || "image/jpeg" });
  }

  const body = new FormData();
  body.append("file", uploadFile);
  const res = await fetch(`${apiBase()}/api/v1/pujari/profile/${kind}`, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throwApiError(data, res, "Upload failed");
  }
  return data;
}

export async function pujariMediaUrl(kind: "photo" | "signature") {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiBase()}/api/v1/pujari/profile/file/${kind}`, { headers });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

export async function openPujariDocument(docId: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiBase()}/api/v1/pujari/documents/${docId}/file`, { headers });
  if (!res.ok) throw new Error("Could not open document");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
}

export async function openAdminPujariDocument(pujariId: string, docId: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(
    `${apiBase()}/api/v1/admin/pujaris/${pujariId}/documents/${docId}/file`,
    { headers }
  );
  if (!res.ok) throw new Error("Could not open document");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
}

/** Resolve stored media paths so `/api/...` works against the API origin in local dev. */
export function mediaSrc(raw?: string | null): string {
  const url = (raw || "").trim();
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  if (url.startsWith("/api/")) {
    const base = apiBase();
    return base ? `${base}${url}` : url;
  }
  return url;
}

export async function uploadPromoImage(file: File) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image must be under 8 MB");
  }
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${apiBase()}/api/v1/admin/promos/images`, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
    if (!res.ok) throwApiError(data, res, "Upload failed");
  return data as { ok: boolean; image_url: string; preview_url?: string };
}

export async function uploadAdminPujariDocument(pujariId: string, file: File, documentType: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const body = new FormData();
  body.append("file", file);
  body.append("document_type", documentType);
  const res = await fetch(`${apiBase()}/api/v1/admin/pujaris/${pujariId}/documents/upload`, {
    method: "POST",
    headers,
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || "Upload failed");
  return data;
}

export type AuthUser = {
  id: string;
  public_id?: string | null;
  name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email: string;
  phone: string;
  role: "customer" | "pujari" | "admin" | "super_admin";
  blocked: boolean;
  preferred_language?: string;
  calendar_preference?: string;
  profile?: Record<string, unknown> | null;
};

export async function loginApi(identifier: string, password: string) {
  const out = await api<{ access_token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  setToken(out.access_token);
  return out;
}

export async function registerApi(payload: Record<string, unknown>) {
  const out = await api<{ access_token: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(out.access_token);
  return out;
}

export async function meApi() {
  return api<AuthUser>("/auth/me");
}

export function logoutApi() {
  setToken(null);
}

export function dashboardPath(role: string) {
  if (role === "admin" || role === "super_admin") return adminPath();
  if (role === "pujari" || role === "priest" || role === "head_pujari") return "/pujari";
  return "/customer";
}

export const rupees = (paise: number) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;

export async function downloadInvoicePdf(invoiceId: string) {
  const token = getToken();
  const res = await fetch(`${apiBase()}/api/v1/invoices/${encodeURIComponent(invoiceId)}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail || "Could not download invoice");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] || "BSeva_Invoice.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
