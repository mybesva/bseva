import { dateInputToIsoEnd, dateInputToIsoStart } from "./isoDateBounds";

export type PromoBannerForm = {
  id?: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  target_url?: string;
  audience: string;
  placement: string;
  start_at?: string | null;
  end_at?: string | null;
  active: boolean;
  display_order: number;
  is_third_party: boolean;
  advertiser?: string;
};

export type PromoPopupForm = {
  id?: string;
  title: string;
  description?: string;
  image_url?: string;
  service_id?: string;
  cta_label?: string;
  cta_url?: string;
  languages: string;
  start_at?: string | null;
  end_at?: string | null;
  active: boolean;
  audience?: string;
};

export const EMPTY_PROMO_BANNER: PromoBannerForm = {
  title: "",
  subtitle: "",
  image_url: "",
  target_url: "",
  audience: "customer",
  placement: "post_login",
  active: false,
  display_order: 100,
  is_third_party: false,
  advertiser: "",
};

export const EMPTY_PROMO_POPUP: PromoPopupForm = {
  title: "",
  description: "",
  image_url: "",
  cta_label: "View",
  cta_url: "",
  languages: "en,hi,te",
  active: false,
  audience: "customer",
};

export const PROMO_AUDIENCES = [
  { id: "customer", label: "Customer" },
  { id: "pujari", label: "Pujari" },
  { id: "all", label: "All" },
] as const;

export const PROMO_PLACEMENTS = [
  { id: "post_login", label: "Post login" },
  { id: "home", label: "Home" },
] as const;

export function promoBannerBody(form: PromoBannerForm, active: boolean) {
  return {
    ...form,
    active,
    start_at: dateInputToIsoStart(form.start_at),
    end_at: dateInputToIsoEnd(form.end_at),
    image_url: form.image_url || null,
    subtitle: form.subtitle || null,
    target_url: form.target_url || null,
    advertiser: form.advertiser || null,
  };
}

export function promoPopupBody(form: PromoPopupForm, active: boolean) {
  return {
    ...form,
    active,
    start_at: dateInputToIsoStart(form.start_at),
    end_at: dateInputToIsoEnd(form.end_at),
    image_url: form.image_url || null,
    description: form.description || null,
    cta_label: form.cta_label || null,
    cta_url: form.cta_url || null,
    service_id: form.service_id || null,
    audience: form.audience || "customer",
  };
}

export function validatePromoBanner(form: PromoBannerForm): string | null {
  if (!form.title.trim()) return "Title is required";
  if (!form.image_url) return "Please upload an image";
  return null;
}

export function validatePromoPopup(form: PromoPopupForm): string | null {
  if (!form.title.trim()) return "Title is required";
  if (!form.image_url) return "Please upload an image";
  if (!form.description?.trim()) return "Message is required";
  return null;
}
