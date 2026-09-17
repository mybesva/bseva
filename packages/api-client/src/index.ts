import { formatApiError, parseApiError, TERMS_VERSION, PRIVACY_VERSION } from "@bseva/config";
import type {
  AuthUser,
  AvailabilityBlock,
  AdminPermissions,
  AppNotification,
  Booking,
  CatalogService,
  Invoice,
  LegalPolicy,
  NearbyPujari,
  NavBadges,
  Paginated,
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
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
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
  getLocale?: () => string | Promise<string | null | undefined>;
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

export function toQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export function asPaginated<T>(data: Paginated<T> | T[] | unknown, fallbackLimit = 50): Paginated<T> {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, limit: data.length || fallbackLimit, pages: 1 };
  }
  if (data && typeof data === "object") {
    const d = data as Paginated<T> & { results?: T[] };
    if (Array.isArray(d.items)) {
      return {
        items: d.items,
        total: Number(d.total ?? d.items.length),
        page: Number(d.page || 1),
        limit: Number(d.limit ?? d.page_size ?? fallbackLimit),
        pages: Number(d.pages || 1),
      };
    }
    if (Array.isArray(d.results)) {
      return { items: d.results, total: d.results.length, page: 1, pages: 1, limit: fallbackLimit };
    }
  }
  return { items: [], total: 0, page: 1, pages: 1, limit: fallbackLimit };
}

export function createApiClient(opts: ApiClientOptions) {
  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!headers.has("Content-Type") && init.body && !isForm) {
      headers.set("Content-Type", "application/json");
    }
    const locale = await opts.getLocale?.();
    if (locale && !headers.has("Accept-Language")) headers.set("Accept-Language", locale);
    const token = await opts.tokenStore.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res: Response;
    try {
      res = await fetch(joinUrl(opts.getBaseUrl(), `/api/v1${path}`), { ...init, headers });
    } catch {
      throw new ApiError("Unable to reach BSeva. Check your connection and try again.", 0, "NETWORK");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const parsed = parseApiError((data as { detail?: unknown }).detail, res.statusText || "Request failed");
      throw new ApiError(parsed.message, res.status, parsed.code);
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
      country?: string;
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
      if (params.country) qs.set("country", params.country);
      return api<Quote>(`/quote?${qs}`);
    },

    serviceAvailability(lat: number, lng: number, service_id?: string) {
      return api<{ service_available: boolean }>(
        `/service-availability${toQuery({ lat, lng, service_id })}`
      );
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

    createBooking(body: Record<string, unknown>, idempotencyKey?: string) {
      const key = idempotencyKey || (typeof body.idempotency_key === "string" ? body.idempotency_key : undefined);
      return api<Booking>("/bookings", {
        method: "POST",
        headers: key ? { "Idempotency-Key": key } : undefined,
        body: JSON.stringify(key ? { ...body, idempotency_key: key } : body),
      });
    },

    async listBookings(params?: Record<string, string | number | boolean | undefined>) {
      const data = await api<Booking[] | Paginated<Booking>>(`/bookings${toQuery(params)}`);
      if (Array.isArray(data)) return data;
      return asPaginated<Booking>(data).items;
    },

    async listBookingsPage(params?: Record<string, string | number | boolean | undefined>) {
      return asPaginated<Booking>(await api(`/bookings${toQuery(params)}`));
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

    requestCompleteOtp(id: string) {
      return api(`/bookings/${id}/complete-otp/request`, { method: "POST" });
    },

    getCompleteOtp(id: string) {
      return api<{ available?: boolean; code?: string | null; message?: string; customer_can_verify?: boolean }>(
        `/bookings/${id}/complete-otp`
      );
    },

    verifyCompleteOtp(id: string, code: string) {
      return api(`/bookings/${id}/complete-otp/verify`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
    },

    adminStartBooking(id: string, reason: string) {
      return api(`/bookings/${id}/admin/start`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },

    adminCompleteBooking(id: string, reason: string) {
      return api(`/bookings/${id}/admin/complete`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },

    pujariTrackingAssignments() {
      return api<{ items: { booking_id: string; gps_interval_seconds?: number }[]; gps_interval_seconds?: number }>(
        "/pujari/tracking-assignments"
      );
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

    updateBookingLocation(id: string, body: { latitude: number; longitude: number; accuracy_m?: number }) {
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

    invoicePdf(id: string) {
      return apiBlob(`/invoices/${id}/pdf`);
    },

    virtualPrecheck(body: Record<string, unknown>) {
      return api<{ ok: boolean; blocked?: boolean; message?: string; country_code?: string }>(
        "/bookings/virtual-precheck",
        { method: "POST", body: JSON.stringify(body) }
      );
    },

    getStartOtp(id: string) {
      return api<{ available?: boolean; code?: string | null; message?: string; window_minutes?: number }>(
        `/bookings/${id}/start-otp`
      );
    },

    meetingInvite(token: string) {
      return api(`/meetings/invite/${encodeURIComponent(token)}`);
    },

    contactMessage(body: Record<string, unknown>) {
      return api("/support/contact", { method: "POST", body: JSON.stringify(body) });
    },

    promoBanners(placement?: string) {
      return api(`/promos/banners${toQuery({ placement })}`).then((d) => asArray<{ id: string; title?: string; subtitle?: string; image_url?: string; target_url?: string }>(d));
    },

    async listNotifications(params?: Record<string, string | number | boolean | undefined>) {
      return asPaginated<AppNotification>(await api(`/notifications${toQuery(params)}`));
    },

    unreadNotificationCount() {
      return api<{ count: number; unread?: number }>("/notifications/unread-count");
    },

    markNotificationRead(id: string) {
      return api(`/notifications/${id}/read`, { method: "POST" });
    },

    markAllNotificationsRead() {
      return api("/notifications/read-all", { method: "POST" });
    },

    registerFcmToken(token: string, platform: "android" | "ios" | "web") {
      return api("/notifications/fcm/token", {
        method: "POST",
        body: JSON.stringify({ token, platform }),
      });
    },

    removeFcmToken(token: string) {
      return api("/notifications/fcm/token/remove", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    },

    sendTestPush() {
      return api("/notifications/fcm/test", { method: "POST" });
    },

    navBadges() {
      return api<NavBadges>("/notifications/nav-badges");
    },

    pujariServiceOffers() {
      return api("/pujari/service-offers");
    },

    applyPujariServiceOffer(service_id: string) {
      return api("/pujari/service-offers/apply", {
        method: "POST",
        body: JSON.stringify({ service_id }),
      });
    },

    savePujariServiceOffers(service_ids: string[]) {
      return api("/pujari/service-offers", {
        method: "PUT",
        body: JSON.stringify({ service_ids }),
      });
    },

    adminMePermissions() {
      return api<AdminPermissions>("/admin/me/permissions");
    },

    adminStats() {
      return api("/admin/stats");
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
      return api<Record<string, unknown>[]>("/muhurta-consultations").then((d) =>
        asArray<Record<string, unknown>>(d)
      );
    },

    updateMuhurta(
      id: string,
      body: { status: string; guidance_notes?: string; linked_booking_id?: string }
    ) {
      return api(
        `/muhurta-consultations/${encodeURIComponent(id)}${toQuery(body)}`,
        { method: "PATCH" }
      );
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
