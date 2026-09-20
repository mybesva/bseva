export const emptyServiceCategoryForm = {
  slug: "",
  name: "",
  description: "",
  sort_order: 0,
  active: true,
};

export function parseAliasList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type AdminServiceForm = {
  name: string;
  slug: string;
  description: string;
  short_description: string;
  full_description: string;
  benefits: string;
  local_name: string;
  spiritual_meaning: string;
  common_occasions: string;
  deity: string;
  tradition_notes: string;
  location_notes: string;
  whats_included: string;
  admin_notes: string;
  process_steps_text: string;
  priests_min: number;
  priests_max: number;
  homa_included: boolean;
  prasadam_included: boolean;
  sankalpa_required: boolean;
  languages_text: string;
  online_nri_price_paise: number | null;
  virtual_domestic_price_paise: number | null;
  virtual_international_price_paise: number | null;
  category: string;
  category_slugs: string[];
  search_aliases_text: string;
  required_level: number;
  standard_price_paise: number | null;
  premium_price_paise: number | null;
  basic_price_paise: number | null;
  main_puja_price_paise: number | null;
  samagri_price_paise: number;
  alankaram_price_paise: number;
  food_price_paise: number;
  samagri_provider: string;
  alankaram_provider: string;
  food_provider: string;
  muhurta_consultation_enabled: boolean;
  muhurta_fee_paise: number;
  dakshina_share_percent: number;
  requires_muhurta: boolean;
  duration_minutes: number;
  pujaris_required: number;
  basic_pujaris_required: number | null;
  standard_pujaris_required: number | null;
  premium_pujaris_required: number | null;
  virtual_available: boolean;
  active: boolean;
  samagri_available: boolean;
  alankaram_available: boolean;
  food_available: boolean;
  image_path: string;
  image_url: string;
  is_popular: boolean;
  is_featured_home: boolean;
  is_seasonal: boolean;
  display_order: number;
  homepage_rank: number | null;
  pricing_status: "priced" | "awaiting_pricing";
  samagri_review_status: "UNVERIFIED" | "VERIFIED" | "NEEDS_REVIEW";
  booking_lead_hours?: number;
};

export function emptyAdminServiceForm(): AdminServiceForm {
  return {
    name: "",
    slug: "",
    description: "",
    short_description: "",
    full_description: "",
    benefits: "",
    local_name: "",
    spiritual_meaning: "",
    common_occasions: "",
    deity: "",
    tradition_notes: "",
    location_notes: "",
    whats_included: "",
    admin_notes: "",
    process_steps_text: "",
    priests_min: 1,
    priests_max: 1,
    homa_included: false,
    prasadam_included: true,
    sankalpa_required: true,
    languages_text: "en, hi, te",
    online_nri_price_paise: null,
    virtual_domestic_price_paise: null,
    virtual_international_price_paise: null,
    category: "puja",
    category_slugs: [],
    search_aliases_text: "",
    required_level: 2,
    standard_price_paise: null,
    premium_price_paise: null,
    basic_price_paise: null,
    main_puja_price_paise: null,
    samagri_price_paise: 0,
    alankaram_price_paise: 0,
    food_price_paise: 0,
    samagri_provider: "included",
    alankaram_provider: "included",
    food_provider: "included",
    muhurta_consultation_enabled: false,
    muhurta_fee_paise: 0,
    dakshina_share_percent: 85,
    requires_muhurta: false,
    duration_minutes: 90,
    pujaris_required: 1,
    basic_pujaris_required: null,
    standard_pujaris_required: null,
    premium_pujaris_required: null,
    virtual_available: false,
    active: false,
    samagri_available: true,
    alankaram_available: false,
    food_available: false,
    image_path: "",
    image_url: "",
    is_popular: false,
    is_featured_home: false,
    is_seasonal: false,
    display_order: 1000,
    homepage_rank: null,
    pricing_status: "awaiting_pricing",
    samagri_review_status: "UNVERIFIED",
    booking_lead_hours: 48,
  };
}

export function adminServiceActivationError(form: Pick<AdminServiceForm, "active" | "standard_price_paise" | "premium_price_paise" | "pricing_status">): string | null {
  if (
    form.active &&
    (form.standard_price_paise == null ||
      form.premium_price_paise == null ||
      form.pricing_status === "awaiting_pricing")
  ) {
    return "Set Standard and Premium prices (priced status) before activating";
  }
  return null;
}

export function buildAdminServicePayload(form: AdminServiceForm): Record<string, unknown> {
  const slug = form.slug || slugFromName(form.name);
  const muhurtaFee = Math.max(0, Math.round(Number(form.muhurta_fee_paise) || 0));
  const pricingStatus =
    form.standard_price_paise != null && form.premium_price_paise != null
      ? form.pricing_status
      : "awaiting_pricing";
  const { search_aliases_text, languages_text, process_steps_text, ...rest } = form;
  return {
    ...rest,
    slug,
    search_aliases: parseAliasList(search_aliases_text),
    category_slugs: form.category_slugs,
    languages: parseAliasList(languages_text),
    process_steps: (process_steps_text || "")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ order: i + 1, text })),
    priests_min: Math.min(20, Math.max(1, Math.round(Number(form.priests_min) || 1))),
    priests_max: Math.min(20, Math.max(1, Math.round(Number(form.priests_max) || 1))),
    online_nri_price_paise: form.virtual_international_price_paise,
    virtual_domestic_price_paise: form.virtual_domestic_price_paise,
    virtual_international_price_paise: form.virtual_international_price_paise,
    standard_price_paise: form.standard_price_paise,
    premium_price_paise: form.premium_price_paise,
    basic_price_paise: null,
    main_puja_price_paise: form.main_puja_price_paise ?? form.standard_price_paise,
    samagri_price_paise: Math.max(0, Math.round(Number(form.samagri_price_paise) || 0)),
    alankaram_price_paise: Math.max(0, Math.round(Number(form.alankaram_price_paise) || 0)),
    food_price_paise: Math.max(0, Math.round(Number(form.food_price_paise) || 0)),
    dakshina_share_percent: Math.min(
      100,
      Math.max(0, Number.isFinite(Number(form.dakshina_share_percent)) ? Number(form.dakshina_share_percent) : 85)
    ),
    muhurta_fee_paise: muhurtaFee,
    duration_minutes: Math.max(15, Math.round(Number(form.duration_minutes) || 90)),
    required_level: Math.min(4, Math.max(1, Number(form.required_level) || 2)),
    pujaris_required: Math.min(20, Math.max(1, Math.round(Number(form.pujaris_required) || 1))),
    basic_pujaris_required: null,
    standard_pujaris_required:
      form.standard_pujaris_required != null
        ? Math.min(20, Math.max(1, Math.round(Number(form.standard_pujaris_required))))
        : null,
    premium_pujaris_required:
      form.premium_pujaris_required != null
        ? Math.min(20, Math.max(1, Math.round(Number(form.premium_pujaris_required))))
        : null,
    display_order: Math.round(Number(form.display_order) || 1000),
    homepage_rank: form.homepage_rank != null ? Math.round(Number(form.homepage_rank)) : null,
    pricing_status: pricingStatus,
    samagri_available: Boolean(form.samagri_available),
    alankaram_available: Boolean(form.alankaram_available),
    image_path: (form.image_path || "").trim() || null,
    image_url: (form.image_url || "").trim() || null,
    virtual_available: form.virtual_available,
  };
}

export function rupeesField(paise?: number | null): string {
  return paise != null ? String(Number(paise) / 100) : "";
}

export function paiseFromRupees(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || v.trim() === "") return null;
  return Math.round(n * 100);
}
