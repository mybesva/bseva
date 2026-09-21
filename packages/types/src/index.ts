import type { CalendarPref, LangCode, Role } from "@bseva/config";

export type AuthUser = {
  id: string;
  public_id?: string | null;
  name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email: string;
  phone: string;
  role: Role | string;
  blocked: boolean;
  preferred_language?: LangCode | string;
  calendar_preference?: CalendarPref | string;
  profile?: Record<string, unknown> | null;
};

export type TokenOut = {
  access_token: string;
  token_type?: string;
  user: AuthUser;
};

export type CatalogService = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  category?: string | null;
  required_level?: number;
  standard_price_paise?: number | null;
  premium_price_paise?: number | null;
  basic_price_paise?: number | null;
  duration_minutes?: number;
  virtual_available?: boolean;
  bookable?: boolean;
  is_featured_home?: boolean;
  is_popular?: boolean;
  image_url?: string | null;
  image_path?: string | null;
  samagri_price_paise?: number | null;
  alankaram_price_paise?: number | null;
  food_price_paise?: number | null;
  samagri_available?: boolean;
  alankaram_available?: boolean;
  food_available?: boolean;
  death_related?: boolean;
  categories?: { slug?: string }[];
  booking_lead_hours?: number | null;
  muhurta_consultation_enabled?: boolean;
  requires_muhurta?: boolean;
  muhurta_fee_paise?: number | null;
  [key: string]: unknown;
};

export type ValidateBookingStart = {
  valid: boolean;
  start?: string;
  reason?: string | null;
  lead_hours: number;
  duration_minutes: number;
  buffer_hours?: number;
  timezone: string;
};

export type ServiceCategory = {
  id?: string;
  slug: string;
  name: string;
  [key: string]: unknown;
};

export type Quote = {
  basePrice?: number;
  locationAdjustment?: number;
  peakFee?: number;
  platformFee?: number;
  pujariShare?: number;
  gstPercent?: number;
  gstAmount?: number;
  totalAmount?: number;
  mainPuja?: number;
  samagri?: number;
  alankaram?: number;
  foodPrasadam?: number;
  pujariReimbursement?: number;
  samagriListPrice?: number;
  alankaramListPrice?: number;
  subtotal?: number;
  discount?: number;
  walletCredit?: number;
  [key: string]: unknown;
};

export type NearbyPujari = {
  id: string;
  name: string;
  approved_level?: number | null;
  distance_km?: number;
  city?: string | null;
  location_label?: string | null;
  experience_years?: number | null;
  languages?: unknown;
  specializations?: unknown;
  available?: boolean;
  [key: string]: unknown;
};

export type PreparationItem = {
  name?: string;
  label?: string;
  quantity?: number | null;
  unit?: string | null;
  optional?: boolean;
  required?: boolean;
  notes?: string | null;
  section?: string;
  [key: string]: unknown;
};

export type BookingPreparation = {
  verified?: boolean;
  pending_message?: string | null;
  preparation_notes?: string | null;
  special_instructions?: string | null;
  prasadam_notes?: string | null;
  venue_notes?: string | null;
  disclaimer?: string | null;
  display_name?: string | null;
  samagri_purchased?: boolean;
  alankaram_purchased?: boolean;
  food_purchased?: boolean;
  selections?: Array<{ key?: string; label?: string; selected?: boolean; provider?: string }>;
  selected_addons?: Array<{ key?: string; label?: string; selected?: boolean; provider?: string }>;
  sections?: Record<string, PreparationItem[]>;
  items?: PreparationItem[];
  [key: string]: unknown;
};

export const PREPARATION_SECTION_KEYS = [
  "included_bseva",
  "customer_arrange",
  "prasadam",
  "home_venue",
  "optional",
] as const;

export type PreparationSectionKey = (typeof PREPARATION_SECTION_KEYS)[number];

function preparationItemKey(item: PreparationItem): string {
  return String(item.name || item.label || "").trim().toLocaleLowerCase();
}

/**
 * Normalizes current and legacy preparation payloads into one canonical split.
 * Items supplied by BSeva/pujari are always removed from customer-arranged items.
 */
export function normalizePreparationSections(
  preparation?: BookingPreparation | null,
): Record<PreparationSectionKey, PreparationItem[]> {
  const source = preparation?.sections || {};
  const included = [
    ...(source.included_bseva || []),
    ...(source.provider_supplied || []),
  ];
  const customer = [
    ...(source.customer_arrange || []),
    ...(source.customer_arranged || []),
  ];
  const includedKeys = new Set(included.map(preparationItemKey).filter(Boolean));
  const unique = (items: PreparationItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = preparationItemKey(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    included_bseva: unique(included),
    customer_arrange: unique(customer).filter((item) => !includedKeys.has(preparationItemKey(item))),
    prasadam: unique(source.prasadam || []),
    home_venue: unique(source.home_venue || source.venue_setup || []),
    optional: unique(source.optional || []),
  };
}

export type Booking = {
  id: string;
  booking_number?: string;
  status: string;
  payment_status?: string;
  service_id?: string;
  service_name?: string;
  service_slug?: string;
  pujari_id?: string;
  pujari_name?: string;
  customer_id?: string;
  customer_name?: string;
  booking_date?: string;
  start_time?: string;
  end_time?: string;
  location_label?: string | null;
  address?: string | null;
  package_type?: string;
  mode?: string;
  total_paise?: number;
  base_price_paise?: number;
  gst_amount_paise?: number;
  platform_fee_paise?: number;
  pujari_payable_paise?: number;
  meeting_url?: string | null;
  special_instructions?: string | null;
  samagri_requested?: boolean;
  alankaram_requested?: boolean;
  food_requested?: boolean;
  customer_display_status?: string;
  awaiting_pujari_assignment?: boolean;
  eligible_pujari_found?: boolean;
  admin_assignment_required?: boolean;
  assignment_status?: "assigned" | "offers_sent" | "admin_assignment_required" | string;
  offers_sent?: number;
  meeting_link_visible?: boolean;
  meeting_reveal_note?: string | null;
  duration_minutes?: number | null;
  pujari_details_visible?: boolean;
  pujari_reveal_note?: string | null;
  pujari_offer_invited?: boolean;
  pujari_accept_required?: boolean;
  preparation?: BookingPreparation | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  [key: string]: unknown;
};

export type Wallet = {
  balance_paise: number;
  transactions?: WalletTxn[];
  [key: string]: unknown;
};

export type WalletTxn = {
  id?: string;
  amount_paise: number;
  type?: string;
  kind?: string;
  note?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type SupportTicket = {
  id: string;
  subject?: string;
  body?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type Invoice = {
  id: string;
  type?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type PujariProfile = Record<string, unknown> & {
  user_id?: string;
  verification_status?: string;
  profile_complete?: boolean;
  onboarding_step?: number;
  profile_completion_percentage?: number;
  approved_level?: number | null;
  requested_level?: number | null;
};

export type PujariDocument = {
  id: string;
  document_type?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type AvailabilityBlock = {
  id: string;
  blocked_date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
  [key: string]: unknown;
};

export type LegalPolicy = {
  slug: string;
  title: string;
  version?: string;
  points?: { title?: string; body: string }[];
};

export type PublicConfig = Record<string, unknown>;

export type AppNotification = {
  id: string;
  title: string;
  body?: string | null;
  category?: string | null;
  link?: string | null;
  is_read?: boolean;
  created_at?: string;
  [key: string]: unknown;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit?: number;
  page_size?: number;
  pages: number;
};

export type AdminPermissions = {
  role: string;
  permissions: string[];
};

export type NavBadges = {
  bookings?: number;
  virtual_puja?: number;
  muhurtham?: number;
  pujaris?: number;
  payments?: number;
  settlements?: number;
  support?: number;
  tooltips?: Record<string, string>;
  [key: string]: unknown;
};
