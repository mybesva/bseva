import { formatApiError, TERMS_VERSION, PRIVACY_VERSION } from "@bseva/config";
import type {
  AuthUser,
  AvailabilityBlock,
  Booking,
  CatalogService,
  Invoice,
  LegalPolicy,
  NearbyPujari,
  PujariDocument,
  PujariProfile,
  PublicConfig,
  Quote,
  ServiceCategory,
  SupportTicket,
  TokenOut,
  Wallet,
} from "@bseva/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function asArray<T>(data: T[] | { items?: T[] } | unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { items?: T[] }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export type TokenStore = {
  getToken: () => Promise<string | null> | string | null;
  setToken: (token: string | null) => Promise<void> | void;
};

export type ApiClientOptions = {
  getBaseUrl: () => string;
  tokenStore: TokenStore;
};

export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export function createApiClient(opts: ApiClientOptions) {
  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!headers.has("Content-Type") && init.body && !isForm) {
      headers.set("Content-Type", "application/json");
    }
    const token = await opts.tokenStore.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res: Response;
    try {
      res = await fetch(joinUrl(opts.getBaseUrl(), `/api/v1${path}`), { ...init, headers });
    } catch {
      throw new ApiError("Unable to reach BSeva. Check your connection and try again.", 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        formatApiError((data as { detail?: unknown }).detail, res.statusText || "Request failed"),
        res.status
      );
    }
    return data as T;
  }

  async function apiBlob(path: string): Promise<Blob> {
    const headers = new Headers();
    const token = await opts.tokenStore.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(joinUrl(opts.getBaseUrl(), `/api/v1${path}`), { headers });
    if (!res.ok) throw new Error("Could not download file");
    return res.blob();
  }

  async function upload<T>(path: string, form: FormData): Promise<T> {
    const headers = new Headers();
    const token = await opts.tokenStore.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(joinUrl(opts.getBaseUrl(), `/api/v1${path}`), {
      method: "POST",
      headers,
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(formatApiError((data as { detail?: unknown }).detail, "Upload failed"), res.status);
    }
    return data as T;
  }

    async function apiText(path: string): Promise<string> {
      const headers = new Headers();
      const token = await opts.tokenStore.getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(joinUrl(opts.getBaseUrl(), `/api/v1${path}`), { headers });
      const text = await res.text();
      if (!res.ok) throw new ApiError(text || "Request failed", res.status);
      return text;
    }

    async function mediaImageSource(path: string) {
      const token = await opts.tokenStore.getToken();
      return {
        uri: `${joinUrl(opts.getBaseUrl(), `/api/v1${path}`)}?t=${Date.now()}`,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      };
    }

  return {
    api,
    apiBlob,
    apiText,
    upload,
    mediaImageSource,
    getBaseUrl: opts.getBaseUrl,

    async login(identifier: string, password: string) {
      const out = await api<TokenOut>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      await opts.tokenStore.setToken(out.access_token);
      return out;
    },

    async register(payload: Record<string, unknown>) {
      const out = await api<TokenOut>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          terms_version: payload.terms_version ?? TERMS_VERSION,
          privacy_version: payload.privacy_version ?? PRIVACY_VERSION,
        }),
      });
      await opts.tokenStore.setToken(out.access_token);
      return out;
    },

    async me() {
      return api<AuthUser>("/auth/me");
    },

    async patchMe(body: Record<string, unknown>) {
      return api<AuthUser>("/auth/me", { method: "PATCH", body: JSON.stringify(body) });
    },

    async changePassword(current_password: string, new_password: string) {
      return api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password, new_password }),
      });
    },

    async requestOtp(body: { phone?: string; email?: string; purpose: "register" | "login" | "verify" }) {
      return api("/auth/otp/request", { method: "POST", body: JSON.stringify(body) });
    },

    async logout() {
      await opts.tokenStore.setToken(null);
    },

    async listServices(params?: Record<string, string | number | boolean | undefined>) {
      const qs = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== "") qs.set(k, String(v));
      });
      const q = qs.toString();
      return asArray<CatalogService>(await api<CatalogService[]>(`/services${q ? `?${q}` : ""}`));
    },

    getService(slug: string) {
      return api<CatalogService>(`/services/${encodeURIComponent(slug)}`);
    },

    async serviceCategories() {
      return asArray<ServiceCategory>(await api<ServiceCategory[]>("/service-categories"));
    },

    serviceImageUrl(slug: string) {
      return joinUrl(opts.getBaseUrl(), `/api/v1/services/${encodeURIComponent(slug)}/image`);
    },

    quote(params: {
      service_id: string;
      package_type?: string;
      city?: string;
      booking_date?: string;
      include_samagri?: boolean;
      include_alankaram?: boolean;
      include_food?: boolean;
    }) {
      const qs = new URLSearchParams({
        service_id: params.service_id,
        package_type: params.package_type || "standard",
        include_samagri: String(!!params.include_samagri),
        include_alankaram: String(!!params.include_alankaram),
        include_food: String(!!params.include_food),
      });
      if (params.city) qs.set("city", params.city);
      if (params.booking_date) qs.set("booking_date", params.booking_date);
      return api<Quote>(`/quote?${qs}`);
    },

    nearbyPujaris(lat: number, lng: number, service_id?: string) {
      const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      if (service_id) qs.set("service_id", service_id);
      return api<NearbyPujari[]>(`/pujaris/nearby?${qs}`).then((d) => asArray<NearbyPujari>(d));
    },

    previousPujaris() {
      return api<NearbyPujari[]>("/pujaris/previous").then((d) => asArray<NearbyPujari>(d));
    },

    listPujaris() {
      return api<NearbyPujari[]>("/pujaris").then((d) => asArray<NearbyPujari>(d));
    },

    publicPujari(id: string) {
      return api(`/pujaris/${id}/public`);
    },

    createBooking(body: Record<string, unknown>) {
      return api<Booking>("/bookings", { method: "POST", body: JSON.stringify(body) });
    },

    async listBookings() {
      return asArray<Booking>(await api<Booking[]>("/bookings"));
    },

    getBooking(id: string) {
      return api<Booking>(`/bookings/${id}`);
    },

    bookingPreparation(id: string) {
      return api(`/bookings/${id}/preparation`);
    },

    cancelPreview(id: string) {
      return api(`/bookings/${id}/cancel-preview`);
    },

    cancelBooking(id: string, reason?: string) {
      const q = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      return api(`/bookings/${id}/cancel${q}`, { method: "POST" });
    },

    payBooking(id: string) {
      return api(`/bookings/${id}/pay`, { method: "POST" });
    },

    acceptBooking(id: string) {
      return api(`/bookings/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ terms_accepted: true, terms_version: TERMS_VERSION }),
      });
    },

    rejectBooking(id: string, reason?: string) {
      return api(`/bookings/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || "" }),
      });
    },

    requestStartOtp(id: string) {
      return api(`/bookings/${id}/start-otp/request`, { method: "POST" });
    },

    verifyStartOtp(id: string, code: string) {
      return api(`/bookings/${id}/start-otp/verify`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
    },

    completeBooking(id: string) {
      return api(`/bookings/${id}/complete`, { method: "POST" });
    },

    rateBooking(id: string, body: Record<string, unknown>) {
      return api(`/bookings/${id}/ratings`, { method: "POST", body: JSON.stringify(body) });
    },

    getBookingLocation(id: string) {
      return api(`/bookings/${id}/location`);
    },

    updateBookingLocation(id: string, body: { latitude: number; longitude: number }) {
      return api(`/bookings/${id}/location`, { method: "POST", body: JSON.stringify(body) });
    },

    cancelRecurring(seriesId: string, reason?: string) {
      const q = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      return api(`/recurring/${seriesId}/cancel${q}`, { method: "POST" });
    },

    getWallet() {
      return api<Wallet>("/wallet");
    },

    loadWallet(amount_paise: number) {
      return api<Wallet>("/wallet/load", {
        method: "POST",
        body: JSON.stringify({ amount_paise }),
      });
    },

    rewards() {
      return api("/wallet/rewards");
    },

    customerReferral() {
      return api("/customer/referral-code");
    },

    applyReferral(code: string) {
      return api("/referrals/apply", { method: "POST", body: JSON.stringify({ code }) });
    },

    invoices() {
      return api<Invoice[]>("/invoices").then((d) => asArray<Invoice>(d));
    },

    invoiceHtml(id: string) {
      return apiText(`/invoices/${id}/html`);
    },

    uploadCustomerPhoto(file: UploadFile) {
      const form = new FormData();
      form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      return upload("/customer/profile/photo", form);
    },

    deleteCustomerPhoto() {
      return api("/customer/profile/photo", { method: "DELETE" });
    },

    customerPhotoUri() {
      return mediaImageSource("/customer/profile/photo");
    },

    getCustomerProfile() {
      return api("/customer/profile");
    },

    patchCustomerProfile(body: Record<string, unknown>) {
      return api("/customer/profile", { method: "PATCH", body: JSON.stringify(body) });
    },

    getPujariProfile() {
      return api<PujariProfile>("/pujari/profile");
    },

    patchPujariProfile(body: Record<string, unknown>) {
      return api<PujariProfile>("/pujari/profile", { method: "PATCH", body: JSON.stringify(body) });
    },

    submitPujariProfile(body?: Record<string, unknown>) {
      return api("/pujari/profile/submit", { method: "POST", body: JSON.stringify(body || {}) });
    },

    payJoiningFee() {
      return api("/pujari/joining-fee/pay", { method: "POST" });
    },

    applyPujariLevel(requested_level: number) {
      return api("/pujari/apply-level", { method: "POST", body: JSON.stringify({ requested_level }) });
    },

    pujariDocuments() {
      return api<PujariDocument[]>("/pujari/documents").then((d) => asArray<PujariDocument>(d));
    },

    officialDocuments() {
      return api("/pujari/official-documents");
    },

    uploadPujariDocument(file: UploadFile, document_type: string) {
      const form = new FormData();
      form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      form.append("document_type", document_type);
      return upload("/pujari/documents/upload", form);
    },

    uploadPujariAsset(kind: "photo" | "signature", file: UploadFile) {
      const form = new FormData();
      form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      return upload(`/pujari/profile/${kind}`, form);
    },

    deletePujariPhoto() {
      return api("/pujari/profile/photo", { method: "DELETE" });
    },

    pujariMediaUri(kind: "photo" | "signature") {
      return mediaImageSource(`/pujari/profile/file/${kind}`);
    },

    getAngikara() {
      return api("/pujari/angikara");
    },

    submitAngikara(body: Record<string, unknown>) {
      return api("/pujari/angikara/submit", { method: "POST", body: JSON.stringify(body) });
    },

    availabilityBlocks() {
      return api<AvailabilityBlock[]>("/pujari/availability/blocks").then((d) => asArray<AvailabilityBlock>(d));
    },

    addAvailabilityBlock(body: Record<string, unknown>) {
      return api("/pujari/availability/blocks", { method: "POST", body: JSON.stringify(body) });
    },

    deleteAvailabilityBlock(id: string) {
      return api(`/pujari/availability/blocks/${id}`, { method: "DELETE" });
    },

    pujariReferral() {
      return api("/pujari/referral-code");
    },

    settlements() {
      return api("/settlements");
    },

    pujariRoles() {
      return api("/pujari-roles");
    },

    legal(slug?: string) {
      return slug ? api<LegalPolicy>(`/legal/${slug}`) : api<LegalPolicy[]>("/legal");
    },

    publicConfig() {
      return api<PublicConfig>("/config/public");
    },

    panchang(date: string, calendar: string) {
      return api(`/panchang?date=${encodeURIComponent(date)}&calendar=${encodeURIComponent(calendar)}`);
    },

    recommendations() {
      return api<{ items?: unknown[] }>("/recommendations");
    },

    astrologyServices() {
      return api("/astrology/services");
    },

    createMuhurta(body: Record<string, unknown>) {
      return api("/muhurta-consultations", { method: "POST", body: JSON.stringify(body) });
    },

    listMuhurta() {
      return api("/muhurta-consultations");
    },

    createSupportTicket(body: Record<string, unknown>) {
      return api<SupportTicket>("/support/tickets", { method: "POST", body: JSON.stringify(body) });
    },

    listSupportTickets() {
      return api<SupportTicket[]>("/support/tickets").then((d) => asArray<SupportTicket>(d));
    },

    serviceSamagri(serviceId: string) {
      return api(`/services/${serviceId}/samagri`);
    },

    servicePreparation(serviceId: string) {
      return api(`/services/${serviceId}/preparation`);
    },

    headRatings() {
      return api("/head/ratings");
    },

    submitHeadRating(body: Record<string, unknown>) {
      return api("/head/ratings", { method: "POST", body: JSON.stringify(body) });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
