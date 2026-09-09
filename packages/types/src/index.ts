import type { CalendarPref, LangCode, Role } from "@bseva/config";

export type AuthUser = {
  id: string;
  name: string;
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
  [key: string]: unknown;
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
