-- Phase 1+ foundation: additive, backward-compatible. Do NOT drop data.

-- Booking status: allow in_progress (API already uses it)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending', 'pending_acceptance', 'confirmed', 'in_progress',
    'completed', 'cancelled', 'rejected'
  ));

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid'
  CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partial_refund'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (settlement_status IN (
    'not_applicable', 'pending', 'eligible', 'processing', 'settled', 'failed', 'held', 'legacy'
  ));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rating_status TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (rating_status IN ('not_applicable', 'pending', 'customer_done', 'pujari_done', 'completed', 'skipped'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wallet_credit_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pujari_payable_paise INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMPTZ;

-- Historical bookings: mark settlement as legacy (already paid via wallet)
UPDATE bookings SET settlement_status = 'legacy'
WHERE settlement_status = 'not_applicable' AND status IN ('confirmed', 'completed', 'in_progress')
  AND pujari_id IS NOT NULL;

-- Users role: add super_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'pujari', 'admin', 'super_admin'));

-- Verification status extension
ALTER TABLE pujari_profiles DROP CONSTRAINT IF EXISTS pujari_profiles_verification_status_check;
ALTER TABLE pujari_profiles ADD CONSTRAINT pujari_profiles_verification_status_check
  CHECK (verification_status IN (
    'pending', 'under_review', 'correction_required', 'approved', 'rejected'
  ));

-- OTP purpose: allow start_puja (in addition to register/login/verify)
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN (
    'register', 'login', 'verify', 'reset', 'verify_email', 'verify_phone', 'start_puja'
  ));

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('virtual_puja_enabled', 'false'::jsonb, 'Allow new Virtual Puja bookings (Super Admin toggle)'),
  ('pujari_settlement_days', '14'::jsonb, 'Days after completion before settlement eligible'),
  ('pujari_share_percent', '85'::jsonb, 'Pujari share of base puja amount'),
  ('loyalty_pujari_puja_count', '10'::jsonb, 'Completed pujas required for pujari loyalty'),
  ('loyalty_pujari_reward_paise', '50000'::jsonb, 'Pujari loyalty reward in paise'),
  ('loyalty_pujari_active', 'true'::jsonb, 'Pujari loyalty campaign active'),
  ('referral_customer_reward_paise', '10000'::jsonb, 'Customer referral reward paise'),
  ('referral_pujari_reward_paise', '10000'::jsonb, 'Pujari referral reward paise'),
  ('referral_customer_active', 'true'::jsonb, 'Customer referral campaign active'),
  ('referral_pujari_active', 'true'::jsonb, 'Pujari referral campaign active'),
  ('puja_start_otp_before_minutes', '10'::jsonb, 'Minutes before puja to send start OTP'),
  ('pujari_location_tracking_before_minutes', '15'::jsonb, 'Minutes before puja to start location tracking'),
  ('pujari_full_booking_details_before_hours', '24'::jsonb, 'Hours before booking when full details visible to pujari'),
  ('bseva_whatsapp_number', '"919876543210"'::jsonb, 'Official WhatsApp number E.164 without +'),
  ('email_from_accounts', '"accounts@b-seva.com"'::jsonb, 'Accounts from-address'),
  ('email_from_support', '"support@b-seva.com"'::jsonb, 'Support from-address'),
  ('email_from_admin', '"admin@b-seva.com"'::jsonb, 'Admin from-address'),
  ('email_from_info', '"info@b-seva.com"'::jsonb, 'Info from-address'),
  ('email_from_contact', '"contact@b-seva.com"'::jsonb, 'Contact from-address')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, permission)
);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_user ON admin_permissions(user_id);

-- Default permission catalog (documentation via rows on super_admin grants)
-- view_customers, create_customers, edit_customers,
-- view_pujaris, create_pujaris, approve_pujaris, verify_pujaris, block_pujaris,
-- view_bookings, manage_bookings, view_payments, manage_settlements,
-- manage_services, manage_samagri, manage_promotions, manage_config, manage_admins, manage_support

CREATE TABLE IF NOT EXISTS booking_terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pujari_id UUID NOT NULL REFERENCES users(id),
  terms_version TEXT NOT NULL,
  terms_slug TEXT NOT NULL DEFAULT 'pujari_booking_terms',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, pujari_id)
);

CREATE TABLE IF NOT EXISTS reward_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('pujari_loyalty', 'customer_referral', 'pujari_referral')),
  title TEXT NOT NULL,
  threshold_count INTEGER,
  reward_paise INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  eligible_service_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID REFERENCES reward_campaigns(id),
  reward_type TEXT NOT NULL,
  reference_booking_id UUID REFERENCES bookings(id),
  reference_user_id UUID REFERENCES users(id),
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'credited', 'cancelled', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMPTZ,
  UNIQUE (user_id, reward_type, reference_booking_id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id),
  referee_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('customer', 'pujari')),
  code TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified', 'rewarded', 'invalid')),
  qualified_booking_id UUID REFERENCES bookings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
  pujari_id UUID NOT NULL REFERENCES users(id),
  customer_payment_paise INTEGER NOT NULL,
  base_puja_paise INTEGER NOT NULL,
  platform_fee_paise INTEGER NOT NULL,
  gst_paise INTEGER NOT NULL DEFAULT 0,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  adjustments_paise INTEGER NOT NULL DEFAULT 0,
  refund_adjustments_paise INTEGER NOT NULL DEFAULT 0,
  pujari_payable_paise INTEGER NOT NULL,
  settlement_amount_paise INTEGER NOT NULL,
  due_date DATE,
  settled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'eligible', 'processing', 'settled', 'failed', 'held')),
  payment_reference TEXT,
  override_flag BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  override_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlements_pujari ON settlements(pujari_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

CREATE TABLE IF NOT EXISTS samagri_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'pcs',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_samagri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  samagri_item_id UUID NOT NULL REFERENCES samagri_items(id),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  optional BOOLEAN NOT NULL DEFAULT FALSE,
  customer_provided BOOLEAN NOT NULL DEFAULT FALSE,
  instructions TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (service_id, samagri_item_id)
);

CREATE TABLE IF NOT EXISTS booking_samagri_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  optional BOOLEAN NOT NULL DEFAULT FALSE,
  customer_provided BOOLEAN NOT NULL DEFAULT FALSE,
  instructions TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  role_from TEXT NOT NULL CHECK (role_from IN ('customer', 'pujari')),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, from_user_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('customer', 'settlement')),
  booking_id UUID REFERENCES bookings(id),
  settlement_id UUID REFERENCES settlements(id),
  user_id UUID NOT NULL REFERENCES users(id),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_paise INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_role TEXT NOT NULL,
  category TEXT NOT NULL,
  related_booking_id UUID REFERENCES bookings(id),
  related_settlement_id UUID REFERENCES settlements(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_admin_id UUID REFERENCES users(id),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pujari_location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pujari_id UUID NOT NULL REFERENCES users(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_location_pings_booking ON pujari_location_pings(booking_id, recorded_at);

ALTER TABLE pujari_blocked_dates ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE pujari_blocked_dates ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
