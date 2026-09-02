from sqlalchemy import text

from app.db import engine

_STMTS = [
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS full_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS father_name TEXT",
    "ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gotra TEXT",
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
            {"title": "Less than 24 hours before booking", "body": "Cancellation is not permitted."},
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
    count = conn.execute(text("SELECT COUNT(*) FROM legal_policies")).scalar() or 0
    if count:
        return
    import json

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
    """
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    """,
    """
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('customer', 'pujari', 'admin', 'super_admin'));
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
]


def _seed_platform_settings(conn) -> None:
    import json

    defaults = {
        "virtual_puja_enabled": False,
        "pujari_settlement_days": 14,
        "pujari_share_percent": 85,
        "loyalty_pujari_puja_count": 10,
        "loyalty_pujari_reward_paise": 50000,
        "loyalty_pujari_active": True,
        "referral_customer_reward_paise": 10000,
        "referral_pujari_reward_paise": 10000,
        "referral_customer_active": True,
        "referral_pujari_active": True,
        "puja_start_otp_before_minutes": 10,
        "pujari_location_tracking_before_minutes": 15,
        "pujari_full_booking_details_before_hours": 24,
        "bseva_whatsapp_number": "919876543210",
        "email_from_accounts": "accounts@b-seva.com",
        "email_from_support": "support@b-seva.com",
        "email_from_admin": "admin@b-seva.com",
        "email_from_info": "info@b-seva.com",
        "email_from_contact": "contact@b-seva.com",
        "weekend_days": [6, 7],
        "weekend_surge_percent": 0,
        "weekend_surge_paise": 0,
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


def ensure_schema() -> None:
    with engine.begin() as conn:
        for stmt in _STMTS:
            conn.execute(text(stmt))
        for stmt in _FOUNDATION_STMTS:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Some ALTER/DO blocks may fail on partially migrated DBs; continue
                pass
        try:
            from app.phase2_migrate import _PHASE2_STMTS

            for stmt in _PHASE2_STMTS:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    pass
        except Exception:
            pass
        _seed_pujari_roles(conn)
        _seed_legal_policies(conn)
        try:
            _seed_platform_settings(conn)
            _seed_reward_campaigns(conn)
            _seed_pujari_booking_terms(conn)
        except Exception:
            pass
        # Mark historical payouts as legacy settlements
        try:
            conn.execute(
                text(
                    """
                    UPDATE bookings SET settlement_status = 'legacy'
                    WHERE (settlement_status IS NULL OR settlement_status = 'not_applicable')
                      AND status IN ('confirmed', 'completed', 'in_progress')
                      AND pujari_id IS NOT NULL
                    """
                )
            )
        except Exception:
            pass


def ensure_pujari_profile_schema() -> None:
    ensure_schema()
