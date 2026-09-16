from sqlalchemy import text

from app.db import engine

_STMTS = [
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS full_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS father_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gotra TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS pravara TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS native_place TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS permanent_address TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS present_address TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS mobile_number TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS qualifications TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS qualification_year INTEGER",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS sampradaya TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS website_publication_consent BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS signature_path TEXT",
    "ALTER TABLE pujari_documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_consent BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_consent_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id) WHERE public_id IS NOT NULL",
    # Speeds eligible-pujari lookup for 10 KM availability (status + coords filter)
    "CREATE INDEX IF NOT EXISTS idx_pujari_profiles_eligible_geo ON pujari_profiles (verification_status, available, approved_level) WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_pujari_profiles_lat_lng ON pujari_profiles (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS district TEXT",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India'",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS district TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India'",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gender TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS languages TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS specializations TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMPTZ",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS final_submission_consent BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS final_submission_consent_at TIMESTAMPTZ",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    """
    CREATE TABLE IF NOT EXISTS pujari_angikara (
      pujari_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'not_started',
      snapshot JSONB,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_document_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL DEFAULT 'ANGIKARA_PATRAM',
      version_number INTEGER NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_blocked_dates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_date DATE NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pujari_id, blocked_date)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_service_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'pending_removal')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by UUID REFERENCES users(id),
      UNIQUE (pujari_id, service_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_pujari_service_offers_pujari ON pujari_service_offers (pujari_id)",
    "CREATE INDEX IF NOT EXISTS idx_pujari_service_offers_status ON pujari_service_offers (status)",
    """
    CREATE TABLE IF NOT EXISTS pujari_service_applications (
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (pujari_id, service_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_verified_services (
      pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified_by UUID REFERENCES users(id),
      PRIMARY KEY (pujari_id, service_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_pujari_service_applications_pujari ON pujari_service_applications (pujari_id)",
    "CREATE INDEX IF NOT EXISTS idx_pujari_verified_services_pujari ON pujari_verified_services (pujari_id)",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS basic_pujaris_required INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS standard_pujaris_required INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS premium_pujaris_required INTEGER",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS bank_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS upi_id TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pujaris_required INTEGER NOT NULL DEFAULT 1",
    """
    UPDATE bookings b
    SET pujaris_required = COALESCE(
      CASE LOWER(COALESCE(b.package_type, 'standard'))
        WHEN 'basic' THEN s.basic_pujaris_required
        WHEN 'premium' THEN s.premium_pujaris_required
        ELSE s.standard_pujaris_required
      END,
      s.pujaris_required,
      1
    )
    FROM services s
    WHERE s.id = b.service_id
      AND (b.pujaris_required IS NULL OR b.pujaris_required <= 1)
    """,
    """
    UPDATE services
    SET
      standard_price_paise = 500000,
      main_puja_price_paise = 500000
    WHERE COALESCE(standard_price_paise, 0) = 0
      AND COALESCE(main_puja_price_paise, 0) = 0
      AND COALESCE(premium_price_paise, 0) = 0
      AND COALESCE(basic_price_paise, 0) = 0
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      level INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      examples JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS legal_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '2026-01',
      sort_order INTEGER NOT NULL DEFAULT 0,
      points JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS legal_policy_translations (
      policy_id UUID NOT NULL REFERENCES legal_policies(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn')),
      title TEXT NOT NULL,
      points JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (policy_id, language_code)
    )
    """,
]

_DEFAULT_PUJARI_ROLES = [
    (1, "Vehicle / Basic Rituals", "Simple rituals such as vehicle puja and other basic rites configured by Admin.", ["Vehicle Puja", "Basic vehicle-related pujas", "Simple/basic rituals"]),
    (2, "Basic Pujas", "Regular household and devotional pujas.", ["Ganapathi Puja", "Lakshmi Puja", "Satyanarayana Puja", "Basic house pujas"]),
    (3, "Main / Major Pujas", "Important or complex ceremonies.", ["Marriage ceremonies", "Gruha Pravesham", "Major house/family ceremonies"]),
    (4, "All Services", "All Level 1–3 services plus any additional advanced services configured by Admin.", ["All Level 1, 2 and 3 services", "Additional advanced services"]),
]


def _seed_pujari_roles(conn) -> None:
    count = conn.execute(text("SELECT COUNT(*) FROM pujari_roles")).scalar() or 0
    if count:
        return
    import json

    for level, title, summary, examples in _DEFAULT_PUJARI_ROLES:
        conn.execute(
            text(
                """
                INSERT INTO pujari_roles (level, title, summary, examples)
                VALUES (:level, :title, :summary, CAST(:examples AS jsonb))
                """
            ),
            {"level": level, "title": title, "summary": summary, "examples": json.dumps(examples)},
        )


_DEFAULT_LEGAL_POLICIES = [
    {
        "slug": "platform_terms",
        "title": "Platform Terms & Conditions",
        "sort_order": 1,
        "points": [
            {"title": "About BSeva", "body": "BSeva is a platform that connects customers with pujaris for religious and ceremonial services. These Terms govern your use of the BSeva website and applications."},
            {"title": "Accounts", "body": "You must provide accurate registration information and keep your credentials secure. BSeva may suspend accounts that violate these Terms or applicable law."},
            {"title": "Pujari verification", "body": "Pujaris must complete profile verification before receiving bookings. Approved service levels are assigned by BSeva administrators after review of submitted information and documents."},
            {"title": "Acceptable use", "body": "You may not misuse the platform, upload false information, harass other users, or attempt unauthorized access to systems or data."},
            {"title": "Changes", "body": "BSeva may update these Terms. Material changes will be reflected by an updated version date. Continued use after changes constitutes acceptance of the updated Terms."},
        ],
    },
    {
        "slug": "booking_terms",
        "title": "Booking Terms & Conditions",
        "sort_order": 2,
        "points": [
            {"title": "Booking confirmation", "body": "Confirming a booking means you accept the selected service, pujari, date, time, package (Standard/Premium), and mode (In-person or Virtual)."},
            {"title": "Availability", "body": "Bookings are subject to availability, pujari verification, and service-level eligibility."},
            {"title": "Pricing", "body": "The checkout total may include GST, service charges and peak-day fees. The amount shown at checkout is charged to your wallet."},
            {"title": "Pujari levels", "body": "Pujaris may only be booked for services allowed by their Admin-approved service level."},
            {"title": "Demo notice", "body": "This is a demonstration application. Payments, OTP, maps, wallets, and document reviews may be mocked."},
        ],
    },
    {
        "slug": "cancellation_policy",
        "title": "Cancellation Policy",
        "sort_order": 3,
        "points": [
            {"title": "More than 48 hours before booking", "body": "10% cancellation charge, 90% refund to your Customer Wallet."},
            {"title": "Between 24 and 48 hours before booking", "body": "50% cancellation charge, 50% refund to your Customer Wallet."},
            {"title": "Less than 24 hours before booking", "body": "100% cancellation charge, no refund. If the pujari cancels in this window, 100% of that puja’s cost is deducted from their wallet (same as no-show) and the customer is refunded in full."},
            {"title": "How timing is calculated", "body": "Cancellation is calculated from the scheduled booking date and time versus the current date and time."},
        ],
    },
    {
        "slug": "privacy",
        "title": "Privacy Policy",
        "sort_order": 4,
        "points": [
            {"title": "Information we collect", "body": "We collect account details, contact information, profile data, addresses, location coordinates, booking history, documents submitted by pujaris, and technical usage data needed to operate the service."},
            {"title": "How we use information", "body": "Information is used to create and manage accounts, match customers with nearby pujaris, process bookings, verify pujari credentials, provide support, and improve the platform."},
            {"title": "Sharing", "body": "We share necessary booking and contact details between customers and assigned pujaris. We do not sell personal information. Service providers assisting BSeva may process data under appropriate safeguards."},
            {"title": "Storage and security", "body": "Data is stored in secured systems with access controls. Passwords are stored using industry-standard hashing. Uploaded documents are accessible only to authorized users."},
            {"title": "Your choices", "body": "You may update profile information, change your password, and request account assistance through BSeva support channels where available."},
            {"title": "Updates", "body": "This Privacy Policy may be updated periodically. The version date indicates the latest revision."},
        ],
    },
]


def _seed_legal_policies(conn) -> None:
    import json

    count = conn.execute(text("SELECT COUNT(*) FROM legal_policies")).scalar() or 0
    if not count:
        for policy in _DEFAULT_LEGAL_POLICIES:
            conn.execute(
                text(
                    """
                    INSERT INTO legal_policies (slug, title, version, sort_order, points)
                    VALUES (:slug, :title, '2026-01', :sort_order, CAST(:points AS jsonb))
                    """
                ),
                {
                    "slug": policy["slug"],
                    "title": policy["title"],
                    "sort_order": policy["sort_order"],
                    "points": json.dumps(policy["points"]),
                },
            )
        return
    cancel = next((p for p in _DEFAULT_LEGAL_POLICIES if p["slug"] == "cancellation_policy"), None)
    if not cancel:
        return
    conn.execute(
        text(
            """
            UPDATE legal_policies
            SET points = CAST(:points AS jsonb), version = '2026-09', updated_at = NOW()
            WHERE slug = 'cancellation_policy'
            """
        ),
        {"points": json.dumps(cancel["points"])},
    )


_FOUNDATION_STMTS = [
    """
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check
    """,
    """
    DO $$ BEGIN
      ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
        CHECK (status IN (
          'pending', 'pending_acceptance', 'confirmed', 'in_progress',
          'completed', 'cancelled', 'rejected'
        ));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid'",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'not_applicable'",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rating_status TEXT DEFAULT 'not_applicable'",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wallet_credit_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pujari_payable_paise INTEGER",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_otp_code TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS samagri_requested BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS alankaram_requested BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS food_requested BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT",

    "ALTER TABLE services ADD COLUMN IF NOT EXISTS basic_price_paise INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_lead_hours INTEGER NOT NULL DEFAULT 48",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS dakshina_share_percent NUMERIC NOT NULL DEFAULT 85",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS first_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS middle_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS last_name TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_url TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_invite_token TEXT",
    """
    CREATE TABLE IF NOT EXISTS support_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES users(id),
      assigned_agent_id UUID REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'open',
      subject TEXT,
      last_response_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS support_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      sender_id UUID REFERENCES users(id),
      sender_role TEXT NOT NULL DEFAULT 'customer',
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system'",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT",
    """
    CREATE TABLE IF NOT EXISTS fcm_device_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fcm_token TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'web'
        CHECK (platform IN ('web', 'android', 'ios')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (fcm_token)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_fcm_device_tokens_user_active
      ON fcm_device_tokens (user_id)
      WHERE active = TRUE
    """,
    """
    UPDATE services
    SET name = replace(name, 'Muhurta Consultation', 'Muhurtham Consultation')
    WHERE name LIKE '%Muhurta Consultation%'
    """,
    """
    UPDATE services
    SET name = replace(name, 'Wedding Muhurta', 'Wedding Muhurtham')
    WHERE name LIKE '%Wedding Muhurta%'
    """,
    """
    UPDATE services
    SET name = replace(name, 'Vivaha Muhurta', 'Vivaha Muhurtham')
    WHERE name LIKE '%Vivaha Muhurta%'
    """,
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS virtual_domestic_price_paise INTEGER",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS virtual_international_price_paise INTEGER",
    """
    UPDATE services
    SET virtual_domestic_price_paise = COALESCE(virtual_domestic_price_paise, online_nri_price_paise)
    WHERE virtual_domestic_price_paise IS NULL
    """,
    """
    UPDATE services
    SET virtual_international_price_paise = COALESCE(virtual_international_price_paise, online_nri_price_paise)
    WHERE virtual_international_price_paise IS NULL
    """,
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_timezone TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_country TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_at_utc TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS virtual_price_tier TEXT",
    "CREATE INDEX IF NOT EXISTS idx_bookings_mode_status ON bookings (mode, status)",
    """
    CREATE TABLE IF NOT EXISTS temples (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      deity TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      timings TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      pujari_name TEXT,
      website TEXT,
      image_url TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_temples_city ON temples (city)",
    "CREATE INDEX IF NOT EXISTS idx_temples_name ON temples (lower(name))",
    "ALTER TABLE temples ADD COLUMN IF NOT EXISTS pujari_name TEXT",
    "ALTER TABLE temples ADD COLUMN IF NOT EXISTS timings TEXT",
    "ALTER TABLE temples ADD COLUMN IF NOT EXISTS contact_phone TEXT",
    """
    CREATE TABLE IF NOT EXISTS promo_banners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      image_url TEXT,
      target_url TEXT,
      audience TEXT NOT NULL DEFAULT 'customer',
      placement TEXT NOT NULL DEFAULT 'post_login',
      start_at TIMESTAMPTZ,
      end_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 100,
      is_third_party BOOLEAN NOT NULL DEFAULT FALSE,
      subtitle TEXT,
      advertiser TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS seasonal_popups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      service_id UUID REFERENCES services(id),
      cta_label TEXT,
      cta_url TEXT,
      languages TEXT DEFAULT 'en,hi,te',
      audience TEXT NOT NULL DEFAULT 'customer',
      display_order INTEGER NOT NULL DEFAULT 100,
      start_at TIMESTAMPTZ,
      end_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS subtitle TEXT",
    "ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS advertiser TEXT",
    "ALTER TABLE seasonal_popups ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'customer'",
    "ALTER TABLE seasonal_popups ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100",
    "ALTER TABLE support_conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'",
    """
    ALTER TABLE muhurta_consultations ADD COLUMN IF NOT EXISTS consultation_type TEXT DEFAULT 'voice'
    """,
    """
    ALTER TABLE muhurta_consultations ADD COLUMN IF NOT EXISTS provider_session_id TEXT
    """,
    """
    ALTER TABLE muhurta_consultations ADD COLUMN IF NOT EXISTS join_status TEXT DEFAULT 'pending'
    """,
    """
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    """,
    """
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%preferred_language%'
      LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.conname);
      END LOOP;
      BEGIN
        ALTER TABLE users ADD CONSTRAINT users_preferred_language_check
          CHECK (preferred_language IN ('en', 'hi', 'te', 'mr', 'ta', 'kn'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END $$
    """,
    """
    DO $$
    DECLARE r record;
    BEGIN
      IF to_regclass('public.customer_profiles') IS NULL THEN
        RETURN;
      END IF;
      FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'customer_profiles'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%preferred_language%'
      LOOP
        EXECUTE format('ALTER TABLE customer_profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
      END LOOP;
      BEGIN
        ALTER TABLE customer_profiles ADD CONSTRAINT customer_profiles_preferred_language_check
          CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'hi', 'te', 'mr', 'ta', 'kn'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END $$
    """,
    """
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('customer', 'pujari', 'head_pujari', 'admin', 'super_admin'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    ALTER TABLE pujari_profiles DROP CONSTRAINT IF EXISTS pujari_profiles_verification_status_check
    """,
    """
    DO $$ BEGIN
      ALTER TABLE pujari_profiles ADD CONSTRAINT pujari_profiles_verification_status_check
        CHECK (verification_status IN (
          'pending', 'under_review', 'correction_required', 'approved', 'rejected'
        ));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      description TEXT,
      updated_by UUID REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS admin_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      granted_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, permission)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS booking_terms_acceptances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      pujari_id UUID NOT NULL REFERENCES users(id),
      terms_version TEXT NOT NULL,
      terms_slug TEXT NOT NULL DEFAULT 'pujari_booking_terms',
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (booking_id, pujari_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reward_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      campaign_type TEXT NOT NULL,
      title TEXT NOT NULL,
      threshold_count INTEGER,
      reward_paise INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      eligible_service_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reward_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      campaign_id UUID REFERENCES reward_campaigns(id),
      reward_type TEXT NOT NULL,
      reference_booking_id UUID REFERENCES bookings(id),
      reference_user_id UUID REFERENCES users(id),
      amount_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      credited_at TIMESTAMPTZ
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id UUID NOT NULL REFERENCES users(id),
      referee_id UUID NOT NULL REFERENCES users(id) UNIQUE,
      role_scope TEXT NOT NULL,
      code TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      qualified_booking_id UUID REFERENCES bookings(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
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
      status TEXT NOT NULL DEFAULT 'pending',
      payment_reference TEXT,
      override_flag BOOLEAN NOT NULL DEFAULT FALSE,
      override_reason TEXT,
      override_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS samagri_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'pcs',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS booking_samagri_snapshot (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT TRUE,
      optional BOOLEAN NOT NULL DEFAULT FALSE,
      customer_provided BOOLEAN NOT NULL DEFAULT FALSE,
      instructions TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      from_user_id UUID NOT NULL REFERENCES users(id),
      to_user_id UUID NOT NULL REFERENCES users(id),
      role_from TEXT NOT NULL,
      stars INTEGER NOT NULL,
      comment TEXT,
      skipped BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (booking_id, from_user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number TEXT NOT NULL UNIQUE,
      invoice_type TEXT NOT NULL,
      booking_id UUID REFERENCES bookings(id),
      settlement_id UUID,
      user_id UUID NOT NULL REFERENCES users(id),
      snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      total_paise INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      fy TEXT PRIMARY KEY,
      last_n INTEGER NOT NULL DEFAULT 0
    )
    """,
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_status TEXT",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_error TEXT",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID'",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_invoice_id UUID",
    "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS gstin TEXT",
    "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS blocked_paise INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS blocked_reason TEXT",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_customer_per_booking
    ON invoices (booking_id)
    WHERE invoice_type = 'customer' AND booking_id IS NOT NULL
    """,
    """
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_number TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id),
      user_role TEXT NOT NULL,
      category TEXT NOT NULL,
      related_booking_id UUID REFERENCES bookings(id),
      related_settlement_id UUID,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      assigned_admin_id UUID REFERENCES users(id),
      resolution TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pujari_location_pings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      pujari_id UUID NOT NULL REFERENCES users(id),
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "ALTER TABLE pujari_blocked_dates ADD COLUMN IF NOT EXISTS start_time TIME",
    "ALTER TABLE pujari_blocked_dates ADD COLUMN IF NOT EXISTS end_time TIME",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT",
    "ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check",
    """
    DO $$ BEGIN
      ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
        CHECK (purpose IN (
          'register', 'login', 'verify', 'reset', 'verify_email', 'verify_phone', 'start_puja'
        ));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    DO $$
    DECLARE r record;
    BEGIN
      IF to_regclass('public.service_translations') IS NULL THEN
        RETURN;
      END IF;
      FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'service_translations'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%language_code%'
      LOOP
        EXECUTE format('ALTER TABLE service_translations DROP CONSTRAINT IF EXISTS %I', r.conname);
      END LOOP;
      BEGIN
        ALTER TABLE service_translations
          ADD CONSTRAINT service_translations_language_code_check
          CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END $$
    """,
    "ALTER TABLE service_translations ADD COLUMN IF NOT EXISTS name TEXT",
    "ALTER TABLE service_translations ADD COLUMN IF NOT EXISTS customer_instructions TEXT",
    "ALTER TABLE service_translations ADD COLUMN IF NOT EXISTS pujari_instructions TEXT",
    """
    CREATE TABLE IF NOT EXISTS category_translations (
      category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn')),
      name TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (category_id, language_code)
    )
    """,
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS complete_otp_code TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS complete_otp_sent_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tracking_stopped_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tracking_stop_reason TEXT",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrival_hit_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE",
    "ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ",
    "ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
    "ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ",
    "ALTER TABLE pujari_location_pings ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION",
    "ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check",
    """
    DO $$ BEGIN
      ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
        CHECK (purpose IN (
          'register', 'login', 'verify', 'reset', 'verify_email', 'verify_phone',
          'start_puja', 'complete_puja'
        ));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
]


def _seed_platform_settings(conn) -> None:
    import json

    defaults = {
        "virtual_puja_enabled": False,
        "pujari_settlement_days": 14,
        "loyalty_pujari_puja_count": 10,
        "loyalty_pujari_reward_paise": 50000,
        "loyalty_pujari_active": True,
        "referral_customer_reward_paise": 10000,
        "referral_pujari_reward_paise": 10000,
        "referral_customer_active": True,
        "referral_pujari_active": True,
        "puja_start_otp_before_minutes": 15,
        "pujari_location_tracking_before_minutes": 15,
        "pujari_full_booking_details_before_hours": 20,
        "pujari_gps_update_interval_seconds": 60,
        "customer_tracking_refresh_seconds": 60,
        "pujari_arrival_radius_meters": 100,
        "pujari_arrival_confirm_pings": 2,
        "puja_complete_otp_before_minutes": 15,
        "puja_otp_expiry_minutes": 240,
        "puja_complete_otp_expiry_minutes": 480,
        "puja_otp_resend_cooldown_seconds": 60,
        "puja_otp_max_requests_per_hour": 5,
        "puja_otp_max_verify_attempts": 5,
        "puja_otp_lock_minutes": 10,
        "bseva_whatsapp_number": "919014654994",
        "email_from_accounts": "accounts@b-seva.com",
        "email_from_support": "support@b-seva.com",
        "email_from_admin": "admin@b-seva.com",
        "email_from_info": "info@b-seva.com",
        "email_from_contact": "contact@b-seva.com",
        "weekend_days": [6, 7],
        "weekend_surge_mode": "percent",
        "weekend_surge_percent": 0,
        "weekend_surge_paise": 0,
        "festival_surge_mode": "amount",
        "festival_surge_percent": 0,
        "festival_surge_paise": 0,
        "festival_surge_dates": [],
        "pujari_joining_fee_enabled": False,
        "pujari_joining_fee_paise": 0,
        "pujari_no_show_penalty_enabled": True,
        "assign_distance_rings_km": [10, 15, 20, 30],
        "invoice_brand_name": "BSeva",
        "invoice_company_name": "BSeva Services Private Limited",
        "invoice_company_address": "123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India",
        "invoice_company_state": "Telangana",
        "invoice_company_pincode": "500034",
        "invoice_company_email": "support@b-seva.com",
        "invoice_website": "www.b-seva.com",
        "invoice_prefix_customer": "BSEVA",
        "invoice_sac_code": "999799",
        "invoice_notes": "Thank you for choosing BSeva.",
    }
    for k, v in defaults.items():
        conn.execute(
            text(
                """
                INSERT INTO platform_settings (key, value)
                VALUES (:k, CAST(:v AS jsonb))
                ON CONFLICT (key) DO NOTHING
                """
            ),
            {"k": k, "v": json.dumps(v)},
        )
    # Move the previous 24h default to the new 20h product default without clobbering custom admin values.
    conn.execute(
        text(
            """
            UPDATE platform_settings
            SET value = CAST(:v AS jsonb)
            WHERE key = 'pujari_full_booking_details_before_hours'
              AND (
                value = CAST('24' AS jsonb)
                OR btrim(COALESCE(value #>> '{}', '')) = '24'
              )
            """
        ),
        {"v": json.dumps(20)},
    )
    addr = "123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India"
    conn.execute(
        text(
            """
            UPDATE platform_settings
            SET value = CAST(:v AS jsonb)
            WHERE key = 'invoice_company_address'
              AND (
                value IS NULL
                OR btrim(COALESCE(value #>> '{}', '')) = ''
              )
            """
        ),
        {"v": json.dumps(addr)},
    )
    conn.execute(
        text(
            """
            UPDATE platform_settings
            SET value = CAST(:v AS jsonb)
            WHERE key = 'invoice_company_name'
              AND btrim(COALESCE(value #>> '{}', '')) IN ('', 'B-Seva', 'BSeva')
            """
        ),
        {"v": json.dumps("BSeva Services Private Limited")},
    )
    conn.execute(
        text(
            """
            INSERT INTO platform_settings (key, value)
            VALUES ('invoice_brand_name', CAST(:v AS jsonb))
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            WHERE btrim(COALESCE(platform_settings.value #>> '{}', '')) IN ('', 'B-Seva')
            """
        ),
        {"v": json.dumps("BSeva")},
    )


def _seed_reward_campaigns(conn) -> None:
    count = conn.execute(text("SELECT COUNT(*) FROM reward_campaigns")).scalar() or 0
    if count:
        return
    conn.execute(
        text(
            """
            INSERT INTO reward_campaigns (code, campaign_type, title, threshold_count, reward_paise, active)
            VALUES
              ('PUJARI_LOYALTY_10', 'pujari_loyalty', '10 Pujas Loyalty', 10, 50000, TRUE),
              ('CUSTOMER_REF_100', 'customer_referral', 'Customer Referral', NULL, 10000, TRUE),
              ('PUJARI_REF_100', 'pujari_referral', 'Pujari Referral', NULL, 10000, TRUE)
            """
        )
    )


def _seed_pujari_booking_terms(conn) -> None:
    row = conn.execute(text("SELECT 1 FROM legal_policies WHERE slug = 'pujari_booking_terms'")).first()
    if row:
        return
    import json

    points = [
        {
            "title": "Non-circumvention",
            "body": (
                "The Pujari agrees not to bypass BSeva and directly provide services to a "
                "BSeva-introduced Customer for 6 months, subject to final legal approval."
            ),
        },
        {
            "title": "Platform rules",
            "body": "The Pujari agrees to follow BSeva booking, OTP start, completion, and settlement processes.",
        },
    ]
    conn.execute(
        text(
            """
            INSERT INTO legal_policies (slug, title, version, sort_order, points)
            VALUES ('pujari_booking_terms', 'Pujari Booking Acceptance Terms', '2026-01', 5, CAST(:p AS jsonb))
            """
        ),
        {"p": json.dumps(points)},
    )


def _exec_safe(conn, stmt: str) -> str | None:
    """Run a statement; on failure roll back to savepoint so the outer txn can continue (Postgres).

    Returns None on success, or a short error string on failure.
    """
    conn.execute(text("SAVEPOINT bseva_mig"))
    try:
        conn.execute(text(stmt))
        conn.execute(text("RELEASE SAVEPOINT bseva_mig"))
        return None
    except Exception as e:
        conn.execute(text("ROLLBACK TO SAVEPOINT bseva_mig"))
        msg = str(getattr(e, "orig", None) or e).split("\n")[0][:180]
        return msg


def ensure_schema(*, quiet: bool = False) -> None:
    def log(msg: str) -> None:
        if not quiet:
            print(msg, flush=True)

    log("Connecting to database…")
    ok = 0
    failed: list[tuple[str, str]] = []

    def run_batch(label: str, stmts: list[str]) -> None:
        nonlocal ok
        log(f"  → {label} ({len(stmts)} statements)")
        for stmt in stmts:
            err = _exec_safe(conn, stmt)
            if err:
                preview = " ".join(stmt.split())[:90]
                failed.append((preview, err))
            else:
                ok += 1

    with engine.begin() as conn:
        conn.execute(text("SET LOCAL statement_timeout = '120s'"))
        conn.execute(text("SET LOCAL lock_timeout = '30s'"))
        log("Connected. Applying schema updates (this can take 1–2 minutes)…")
        run_batch("core", list(_STMTS))
        run_batch("foundation", list(_FOUNDATION_STMTS))
        try:
            from app.phase2_migrate import _PHASE2_STMTS

            run_batch("phase2", list(_PHASE2_STMTS))
        except Exception as e:
            log(f"  ! phase2 skipped: {e}")
        try:
            from app.phase3_migrate import _PHASE3_STMTS

            run_batch("phase3", list(_PHASE3_STMTS))
        except Exception as e:
            log(f"  ! phase3 skipped: {e}")
        try:
            from app.phase4_catalog_migrate import _PHASE4_STMTS

            run_batch("phase4", list(_PHASE4_STMTS))
        except Exception as e:
            log(f"  ! phase4 skipped: {e}")
        try:
            from app.phase5_samagri_migrate import _PHASE5_STMTS

            run_batch("phase5", list(_PHASE5_STMTS))
        except Exception as e:
            log(f"  ! phase5 skipped: {e}")
        try:
            from app.phase6_puja_master_migrate import _PHASE6_STMTS

            run_batch("phase6", list(_PHASE6_STMTS))
        except Exception as e:
            log(f"  ! phase6 skipped: {e}")
        try:
            from app.phase7_booking_offers_migrate import _PHASE7_STMTS

            run_batch("phase7", list(_PHASE7_STMTS))
        except Exception as e:
            log(f"  ! phase7 skipped: {e}")
        # Backfill main_puja_price from standard when null
        err = _exec_safe(
            conn,
            """
            UPDATE services SET main_puja_price_paise = standard_price_paise
            WHERE main_puja_price_paise IS NULL
              AND standard_price_paise IS NOT NULL
            """,
        )
        if err:
            failed.append(("backfill main_puja_price", err))
        else:
            ok += 1
        try:
            from app.catalog_seed import ensure_catalog

            log("  → catalog seed")
            conn.execute(text("SAVEPOINT bseva_catalog"))
            try:
                ensure_catalog(conn)
                conn.execute(text("RELEASE SAVEPOINT bseva_catalog"))
                ok += 1
            except Exception as e:
                conn.execute(text("ROLLBACK TO SAVEPOINT bseva_catalog"))
                failed.append(("catalog seed", str(e).split("\n")[0][:180]))
        except Exception as e:
            log(f"  ! catalog seed skipped: {e}")
        try:
            from app.samagri_seed import ensure_samagri_content

            log("  → samagri seed")
            conn.execute(text("SAVEPOINT bseva_samagri"))
            try:
                ensure_samagri_content(conn)
                conn.execute(text("RELEASE SAVEPOINT bseva_samagri"))
                ok += 1
            except Exception as e:
                conn.execute(text("ROLLBACK TO SAVEPOINT bseva_samagri"))
                failed.append(("samagri seed", str(e).split("\n")[0][:180]))
        except Exception as e:
            log(f"  ! samagri seed skipped: {e}")
        try:
            from app.puja_catalog_import import ensure_puja_catalog_import

            log("  → puja catalog import")
            conn.execute(text("SAVEPOINT bseva_puja_docs"))
            try:
                ensure_puja_catalog_import(conn)
                conn.execute(text("RELEASE SAVEPOINT bseva_puja_docs"))
                ok += 1
            except Exception as e:
                conn.execute(text("ROLLBACK TO SAVEPOINT bseva_puja_docs"))
                failed.append(("puja catalog import", str(e).split("\n")[0][:180]))
        except Exception as e:
            log(f"  ! puja catalog import skipped: {e}")
        try:
            from app.catalog_i18n_seed import ensure_catalog_translations

            log("  → six-language catalog translations")
            conn.execute(text("SAVEPOINT bseva_catalog_i18n"))
            try:
                ensure_catalog_translations(conn)
                conn.execute(text("RELEASE SAVEPOINT bseva_catalog_i18n"))
                ok += 1
            except Exception as e:
                conn.execute(text("ROLLBACK TO SAVEPOINT bseva_catalog_i18n"))
                failed.append(("catalog i18n seed", str(e).split("\n")[0][:180]))
        except Exception as e:
            log(f"  ! catalog i18n seed skipped: {e}")
        log("  → seeds (roles, legal, settings)")
        _seed_pujari_roles(conn)
        _seed_legal_policies(conn)
        try:
            _seed_platform_settings(conn)
            _seed_reward_campaigns(conn)
            _seed_pujari_booking_terms(conn)
        except Exception as e:
            failed.append(("platform seeds", str(e).split("\n")[0][:180]))
        # Mark historical payouts as legacy settlements
        for label, stmt in (
            (
                "legacy settlements",
                """
            UPDATE bookings SET settlement_status = 'legacy'
            WHERE (settlement_status IS NULL OR settlement_status = 'not_applicable')
              AND status IN ('confirmed', 'completed', 'in_progress')
              AND pujari_id IS NOT NULL
            """,
            ),
            (
                "demo pujari name",
                """
            UPDATE users
            SET name = 'Pandit'
            WHERE name ILIKE '%Reddy%'
               OR (lower(email) = 'pujari2@bseva.test' AND name <> 'Pandit')
            """,
            ),
            (
                "demo pujari profile",
                """
            UPDATE pujari_profiles pp
            SET full_name = 'Pandit',
                mobile_number = COALESCE(
                  NULLIF(regexp_replace(pp.mobile_number, '\\D', '', 'g'), ''),
                  NULLIF(regexp_replace(u.phone, '\\D', '', 'g'), '')
                )
            FROM users u
            WHERE pp.user_id = u.id
              AND (
                pp.full_name ILIKE '%Reddy%'
                OR lower(u.email) = 'pujari2@bseva.test'
              )
            """,
            ),
            (
                "normalize mobile",
                """
            UPDATE pujari_profiles
            SET mobile_number = right(regexp_replace(mobile_number, '\\D', '', 'g'), 10)
            WHERE mobile_number IS NOT NULL
              AND length(regexp_replace(mobile_number, '\\D', '', 'g')) > 10
            """,
            ),
        ):
            err = _exec_safe(conn, stmt)
            if err:
                failed.append((label, err))
            else:
                ok += 1

        # Verify columns we care about for recent features
        log("  → verifying recent columns")
        for table, col in (
            ("services", "booking_lead_hours"),
            ("bookings", "meeting_url"),
            ("bookings", "google_calendar_event_id"),
            ("bookings", "meeting_invite_token"),
            ("temples", "pujari_name"),
            ("temples", "contact_phone"),
        ):
            present = conn.execute(
                text(
                    """
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = :t AND column_name = :c
                    """
                ),
                {"t": table, "c": col},
            ).first()
            log(f"     {table}.{col}: {'OK' if present else 'MISSING'}")

    # Assign CUST-/PUJ- public IDs for existing users (outside the DDL transaction)
    try:
        from app.db import SessionLocal
        from app.public_ids import backfill_missing_public_ids

        log("  → backfill users.public_id")
        db = SessionLocal()
        try:
            n = backfill_missing_public_ids(db)
            db.commit()
            log(f"     assigned {n} public_id(s)")
            ok += 1
        except Exception as e:
            db.rollback()
            failed.append(("backfill public_id", str(e).split("\n")[0][:180]))
        finally:
            db.close()
    except Exception as e:
        log(f"  ! public_id backfill skipped: {e}")

    log(f"Schema migrate finished. Applied/ok steps: {ok}. Failed statements: {len(failed)}.")
    if failed:
        log("Failed (first 15):")
        for preview, err in failed[:15]:
            log(f"  - {preview}")
            log(f"    {err}")
        log("Note: IF NOT EXISTS failures are rare; lock/timeout or permission errors are more common.")
    else:
        log("All statements succeeded (or were already applied).")


def ensure_pujari_profile_schema() -> None:
    ensure_schema()
