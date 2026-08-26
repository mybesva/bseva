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

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiBase()}/api/v1${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: unknown }).detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).join(", ")
          : res.statusText;
    throw new Error(message || "Request failed");
  }
  return data as T;
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
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${apiBase()}/api/v1/pujari/profile/${kind}`, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || "Upload failed");
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

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "pujari" | "admin";
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
  if (role === "admin") return "/admin";
  if (role === "pujari" || role === "priest") return "/pujari";
  return "/customer";
}

export const rupees = (paise: number) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
